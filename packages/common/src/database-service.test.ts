import type {
	DynamoDBClient,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import type {
	BatchGetCommand,
	BatchWriteCommand,
	DynamoDBDocumentClient,
	ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';
import { buildProduct } from '@mocks/ProductFixtures';
import { DynamoService } from '@common/database-service';
import type { Product } from '@common/models';

describe('DynamoService', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('saves a product to the pricing and product-article tables', async () => {
		const send = jest
			.fn<(command: UpdateItemCommand) => Promise<object>>()
			.mockResolvedValue({});
		const service = new DynamoService(
			'TEST',
			'affiliate-product-directory-pricing-TEST',
			'affiliate-product-directory-product-article-TEST',
			{ send } as unknown as DynamoDBClient,
			{} as unknown as DynamoDBDocumentClient,
		);

		await service.saveProduct({
			pricing: {
				productMerchantUrl: 'https://example.com/product',
				region: 'GB',
			},
			article: {
				productMerchantUrl: 'https://example.com/product',
				articleUrl: 'filter/sep/3/best-products',
			},
		});

		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls).toEqual([
			[
				expect.objectContaining({
					input: {
						TableName: 'affiliate-product-directory-pricing-TEST',
						Key: {
							productMerchantUrl: { S: 'https://example.com/product' },
						},
						UpdateExpression:
							'SET #region = :region REMOVE #removed, #removedDate',
						ExpressionAttributeNames: {
							'#region': 'region',
							'#removed': 'removed',
							'#removedDate': 'removedDate',
						},
						ExpressionAttributeValues: {
							':region': { S: 'GB' },
							':removed': { S: 'true' },
						},
						ConditionExpression:
							'attribute_not_exists(productMerchantUrl) OR #removed = :removed',
					},
				}),
			],
			[
				expect.objectContaining({
					input: {
						TableName: 'affiliate-product-directory-product-article-TEST',
						Key: {
							productMerchantUrl: { S: 'https://example.com/product' },
							articleUrl: { S: 'filter/sep/3/best-products' },
						},
						UpdateExpression:
							'SET #composerArticleId = :composerArticleId REMOVE #removed, #removedDate',
						ExpressionAttributeNames: {
							'#composerArticleId': 'composerArticleId',
							'#removed': 'removed',
							'#removedDate': 'removedDate',
						},
						ExpressionAttributeValues: {
							':composerArticleId': { S: '' },
							':removed': { S: 'true' },
						},
						ConditionExpression:
							'attribute_not_exists(productMerchantUrl) OR #removed = :removed',
					},
				}),
			],
		]);
	});

	it('propagates a failed DynamoDB write', async () => {
		const error = new Error('DynamoDB is unavailable');
		const send = jest
			.fn<(command: UpdateItemCommand) => Promise<object>>()
			.mockRejectedValue(error);
		const service = new DynamoService(
			'TEST',
			'affiliate-product-directory-pricing-TEST',
			'affiliate-product-directory-product-article-TEST',
			{ send } as unknown as DynamoDBClient,
			{} as unknown as DynamoDBDocumentClient,
		);

		await expect(
			service.saveProduct({
				pricing: {
					productMerchantUrl: 'https://example.com/product',
					region: 'GB',
				},
				article: {
					productMerchantUrl: 'https://example.com/product',
					articleUrl: 'filter/sep/3/best-products',
				},
			}),
		).rejects.toThrow(error);
	});

	describe('getAllProducts', () => {
		it('scans the pricing table and returns the unmarshalled items', async () => {
			// The document client hands back plain JS objects, not the
			// { S: ... } / { N: ... } attribute-value format.
			const items = [buildProduct(), buildProduct()];
			const send = jest
				.fn<(command: ScanCommand) => Promise<object>>()
				.mockResolvedValue({ Items: items });
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			await expect(service.getAllProducts({})).resolves.toEqual(items);
			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0]![0].input).toMatchObject({
				TableName: 'affiliate-product-directory-pricing-TEST',
				ConsistentRead: true,
			});
		});

		it('follows LastEvaluatedKey pages and concatenates every item', async () => {
			const firstPage = [buildProduct({ region: 'GB' })];
			const secondPage = [buildProduct({ region: 'US' })];
			const lastEvaluatedKey = {
				productMerchantUrl: { S: 'https://example.com/product' },
			};
			const send = jest
				.fn<(command: ScanCommand) => Promise<object>>()
				.mockResolvedValueOnce({
					Items: firstPage,
					LastEvaluatedKey: lastEvaluatedKey,
				})
				.mockResolvedValueOnce({ Items: secondPage });
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			await expect(service.getAllProducts({})).resolves.toEqual([
				...firstPage,
				...secondPage,
			]);
			expect(send).toHaveBeenCalledTimes(2);
			expect(send.mock.calls[0]![0].input).toMatchObject({
				ExclusiveStartKey: undefined,
			});
			expect(send.mock.calls[1]![0].input).toMatchObject({
				ExclusiveStartKey: lastEvaluatedKey,
			});
		});
	});

	describe('getProductsByUrl', () => {
		const pricingTable = 'affiliate-product-directory-pricing-TEST';

		function serviceWith(
			send: jest.Mock<(command: BatchGetCommand) => Promise<object>>,
		) {
			return new DynamoService(
				'TEST',
				pricingTable,
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);
		}

		const requestedUrls = (command: BatchGetCommand) =>
			command.input.RequestItems?.[pricingTable]?.Keys?.map(
				(key) => key.productMerchantUrl as string,
			);

		it('reads the products with a strongly consistent BatchGetCommand', async () => {
			const products = [
				buildProduct({ productMerchantUrl: 'https://example.com/1' }),
				buildProduct({ productMerchantUrl: 'https://example.com/2' }),
			];
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockResolvedValue({ Responses: { [pricingTable]: products } });

			await expect(
				serviceWith(send).getProductsByUrl([
					'https://example.com/1',
					'https://example.com/2',
				]),
			).resolves.toEqual(products);
			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0]![0].input).toEqual({
				RequestItems: {
					[pricingTable]: {
						Keys: [
							{ productMerchantUrl: 'https://example.com/1' },
							{ productMerchantUrl: 'https://example.com/2' },
						],
						ConsistentRead: true,
					},
				},
			});
		});

		it('asks for a URL given more than once only once', async () => {
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockResolvedValue({});

			await serviceWith(send).getProductsByUrl([
				'https://example.com/1',
				'https://example.com/2',
				'https://example.com/1',
			]);

			expect(requestedUrls(send.mock.calls[0]![0])).toEqual([
				'https://example.com/1',
				'https://example.com/2',
			]);
		});

		it("splits the URLs into requests of 100 (DynamoDB's BatchGetItem limit) and combines the products", async () => {
			const urls = Array.from(
				{ length: 150 },
				(_, i) => `https://example.com/${i}`,
			);
			const first = buildProduct({ productMerchantUrl: urls[0] });
			const last = buildProduct({ productMerchantUrl: urls[149] });
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockResolvedValueOnce({ Responses: { [pricingTable]: [first] } })
				.mockResolvedValueOnce({ Responses: { [pricingTable]: [last] } });

			await expect(serviceWith(send).getProductsByUrl(urls)).resolves.toEqual([
				first,
				last,
			]);
			expect(
				send.mock.calls.map(([command]) => requestedUrls(command)),
			).toEqual([urls.slice(0, 100), urls.slice(100)]);
		});

		it('does not call DynamoDB when there are no URLs', async () => {
			const send = jest.fn<(command: BatchGetCommand) => Promise<object>>();

			await expect(serviceWith(send).getProductsByUrl([])).resolves.toEqual([]);
			expect(send).not.toHaveBeenCalled();
		});

		it('asks again for only the unprocessed URLs after a delay', async () => {
			jest.useFakeTimers();
			const first = buildProduct({
				productMerchantUrl: 'https://example.com/1',
			});
			const second = buildProduct({
				productMerchantUrl: 'https://example.com/2',
			});
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockResolvedValueOnce({
					Responses: { [pricingTable]: [first] },
					UnprocessedKeys: {
						[pricingTable]: {
							Keys: [{ productMerchantUrl: 'https://example.com/2' }],
							ConsistentRead: true,
						},
					},
				})
				.mockResolvedValueOnce({ Responses: { [pricingTable]: [second] } });

			const pending = serviceWith(send).getProductsByUrl([
				'https://example.com/1',
				'https://example.com/2',
			]);
			await jest.advanceTimersByTimeAsync(500);

			await expect(pending).resolves.toEqual([first, second]);
			expect(requestedUrls(send.mock.calls[1]![0])).toEqual([
				'https://example.com/2',
			]);
		});

		it('throws once URLs are still unprocessed after the max number of attempts', async () => {
			jest.useFakeTimers();
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockResolvedValue({
					UnprocessedKeys: {
						[pricingTable]: {
							Keys: [{ productMerchantUrl: 'https://example.com/1' }],
						},
					},
				});

			const pending = serviceWith(send).getProductsByUrl([
				'https://example.com/1',
			]);
			// Swallow the eventual rejection so it isn't reported as unhandled
			// while we're still advancing timers below.
			pending.catch(() => {});
			await jest.advanceTimersByTimeAsync(500);

			await expect(pending).rejects.toThrow(
				'1 item(s) still unprocessed after 2 attempts reading from affiliate-product-directory-pricing-TEST',
			);
			expect(send).toHaveBeenCalledTimes(2);
		});

		it('propagates a failed read', async () => {
			const error = new Error('DynamoDB is unavailable');
			const send = jest
				.fn<(command: BatchGetCommand) => Promise<object>>()
				.mockRejectedValue(error);

			await expect(
				serviceWith(send).getProductsByUrl(['https://example.com/1']),
			).rejects.toThrow(error);
		});
	});

	describe('updateProducts', () => {
		// batchUpdateProducts is private; spying on it lets these tests check
		// updateProducts' own job (chunking and delegating) without also
		// exercising the DynamoDB write/retry behaviour tested below.
		function spyOnBatchUpdateProducts(service: DynamoService) {
			return jest
				.spyOn(
					service as unknown as {
						batchUpdateProducts: DynamoService['updateProducts'];
					},
					'batchUpdateProducts',
				)
				.mockResolvedValue(undefined);
		}

		it('calls batchUpdateProducts once for a batch of 25 or fewer items', async () => {
			const items = [
				buildProduct({ productMerchantUrl: 'https://example.com/1' }),
				buildProduct({ productMerchantUrl: 'https://example.com/2' }),
			];
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{} as unknown as DynamoDBDocumentClient,
			);
			const batchUpdateProducts = spyOnBatchUpdateProducts(service);

			await service.updateProducts({ items });

			expect(batchUpdateProducts).toHaveBeenCalledTimes(1);
			expect(batchUpdateProducts).toHaveBeenCalledWith({
				batch: items,
				attempt: 1,
			});
		});

		it("splits items into chunks of 25 (DynamoDB's BatchWriteItem limit) and calls batchUpdateProducts per chunk", async () => {
			const items = Array.from({ length: 30 }, (_, i) =>
				buildProduct({ productMerchantUrl: `https://example.com/${i}` }),
			);
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{} as unknown as DynamoDBDocumentClient,
			);
			const batchUpdateProducts = spyOnBatchUpdateProducts(service);

			await service.updateProducts({ items });

			expect(batchUpdateProducts).toHaveBeenCalledTimes(2);
			expect(batchUpdateProducts).toHaveBeenNthCalledWith(1, {
				batch: items.slice(0, 25),
				attempt: 1,
			});
			expect(batchUpdateProducts).toHaveBeenNthCalledWith(2, {
				batch: items.slice(25),
				attempt: 1,
			});
		});

		it('propagates a rejection from batchUpdateProducts', async () => {
			const error = new Error('DynamoDB is unavailable');
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{} as unknown as DynamoDBDocumentClient,
			);
			jest
				.spyOn(
					service as unknown as {
						batchUpdateProducts: DynamoService['updateProducts'];
					},
					'batchUpdateProducts',
				)
				.mockRejectedValue(error);

			await expect(
				service.updateProducts({ items: [buildProduct()] }),
			).rejects.toThrow(error);
		});
	});

	describe('batchUpdateProducts', () => {
		// batchUpdateProducts is private; call it directly so these tests can
		// cover its DynamoDB write/retry behaviour in isolation from
		// updateProducts' chunking.
		function callBatchUpdateProducts(
			service: DynamoService,
			args: { batch: Product[]; attempt: number },
		): Promise<void> {
			return (
				service as unknown as {
					batchUpdateProducts: (args: {
						batch: Product[];
						attempt: number;
					}) => Promise<void>;
				}
			).batchUpdateProducts(args);
		}

		it('writes every item in the batch with a single BatchWriteCommand', async () => {
			const batch = [
				buildProduct({ productMerchantUrl: 'https://example.com/1' }),
				buildProduct({ productMerchantUrl: 'https://example.com/2' }),
			];
			const send = jest
				.fn<(command: BatchWriteCommand) => Promise<object>>()
				.mockResolvedValue({});
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			await callBatchUpdateProducts(service, { batch, attempt: 1 });

			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0]![0].input).toEqual({
				RequestItems: {
					'affiliate-product-directory-pricing-TEST': [
						{ PutRequest: { Item: batch[0] } },
						{ PutRequest: { Item: batch[1] } },
					],
				},
			});
		});

		it('propagates a failed batch write', async () => {
			const error = new Error('DynamoDB is unavailable');
			const send = jest
				.fn<(command: BatchWriteCommand) => Promise<object>>()
				.mockRejectedValue(error);
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			await expect(
				callBatchUpdateProducts(service, {
					batch: [buildProduct()],
					attempt: 1,
				}),
			).rejects.toThrow(error);
		});

		it('retries only the unprocessed items after a delay', async () => {
			jest.useFakeTimers();
			const batch = [
				buildProduct({ productMerchantUrl: 'https://example.com/1' }),
				buildProduct({ productMerchantUrl: 'https://example.com/2' }),
			];
			const send = jest
				.fn<(command: BatchWriteCommand) => Promise<object>>()
				.mockResolvedValueOnce({
					UnprocessedItems: {
						'affiliate-product-directory-pricing-TEST': [
							{ PutRequest: { Item: batch[1] } },
						],
					},
				})
				.mockResolvedValueOnce({});
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			const pending = callBatchUpdateProducts(service, {
				batch,
				attempt: 1,
			});
			await jest.advanceTimersByTimeAsync(500);
			await pending;

			expect(send).toHaveBeenCalledTimes(2);
			expect(send.mock.calls[1]![0].input).toEqual({
				RequestItems: {
					'affiliate-product-directory-pricing-TEST': [
						{ PutRequest: { Item: batch[1] } },
					],
				},
			});
		});

		it('throws once items are still unprocessed after the max number of attempts', async () => {
			jest.useFakeTimers();
			const item = buildProduct();
			const send = jest
				.fn<(command: BatchWriteCommand) => Promise<object>>()
				.mockResolvedValue({
					UnprocessedItems: {
						'affiliate-product-directory-pricing-TEST': [
							{ PutRequest: { Item: item } },
						],
					},
				});
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{} as unknown as DynamoDBClient,
				{ send } as unknown as DynamoDBDocumentClient,
			);

			const pending = callBatchUpdateProducts(service, {
				batch: [item],
				attempt: 1,
			});
			// Swallow the eventual rejection so it isn't reported as unhandled
			// while we're still advancing timers below.
			pending.catch(() => {});
			await jest.advanceTimersByTimeAsync(500);

			await expect(pending).rejects.toThrow(
				'1 item(s) still unprocessed after 2 attempts writing to affiliate-product-directory-pricing-TEST',
			);
			expect(send).toHaveBeenCalledTimes(2);
		});
	});
});
