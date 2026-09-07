import type {
	DynamoDBClient,
	PutItemCommand,
	ScanCommand,
} from '@aws-sdk/client-dynamodb';
import type { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';
import { buildProduct } from '@mocks/ProductFixtures';
import { DynamoService } from './database-service';

describe('DynamoService', () => {
	it('saves a product to the pricing and product-article tables', async () => {
		const send = jest
			.fn<(command: PutItemCommand) => Promise<object>>()
			.mockResolvedValue({});
		const service = new DynamoService(
			'TEST',
			'affiliate-product-directory-pricing-TEST',
			'affiliate-product-directory-product-article-TEST',
			{ send } as unknown as DynamoDBClient,
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
						Item: {
							productMerchantUrl: { S: 'https://example.com/product' },
							region: { S: 'GB' },
						},
						ConditionExpression: 'attribute_not_exists(productMerchantUrl)',
					},
				}),
			],
			[
				expect.objectContaining({
					input: {
						TableName: 'affiliate-product-directory-product-article-TEST',
						Item: {
							productMerchantUrl: { S: 'https://example.com/product' },
							articleUrl: { S: 'filter/sep/3/best-products' },
							composerArticleId: { S: '' },
						},
						ConditionExpression: 'attribute_not_exists(productMerchantUrl)',
					},
				}),
			],
		]);
	});

	it('propagates a failed DynamoDB write', async () => {
		const error = new Error('DynamoDB is unavailable');
		const send = jest
			.fn<(command: PutItemCommand) => Promise<object>>()
			.mockRejectedValue(error);
		const service = new DynamoService(
			'TEST',
			'affiliate-product-directory-pricing-TEST',
			'affiliate-product-directory-product-article-TEST',
			{ send } as unknown as DynamoDBClient,
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
		it('scans the pricing table and returns the items', async () => {
			const items = [buildProduct(), buildProduct()];
			const send = jest
				.fn<(command: ScanCommand) => Promise<object>>()
				.mockResolvedValue({ Items: items });
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{ send } as unknown as DynamoDBClient,
			);

			await expect(service.getAllProducts({})).resolves.toEqual(items);
			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0]![0].input).toMatchObject({
				TableName: 'affiliate-product-directory-pricing-TEST',
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
				{ send } as unknown as DynamoDBClient,
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

	describe('batchUpdateProducts', () => {
		it('writes every item in a single batch when there are 25 or fewer', async () => {
			const items = [
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
				{ send } as unknown as DynamoDBClient,
			);

			await service.batchUpdateProducts({ items });

			expect(send).toHaveBeenCalledTimes(1);
			expect(send.mock.calls[0]![0].input).toEqual({
				RequestItems: {
					'affiliate-product-directory-pricing-TEST': [
						{ PutRequest: { Item: items[0] } },
						{ PutRequest: { Item: items[1] } },
					],
				},
			});
		});

		it("splits items into chunks of 25 (DynamoDB's BatchWriteItem limit)", async () => {
			const items = Array.from({ length: 30 }, (_, i) =>
				buildProduct({ productMerchantUrl: `https://example.com/${i}` }),
			);
			const send = jest
				.fn<(command: BatchWriteCommand) => Promise<object>>()
				.mockResolvedValue({});
			const service = new DynamoService(
				'TEST',
				'affiliate-product-directory-pricing-TEST',
				'affiliate-product-directory-product-article-TEST',
				{ send } as unknown as DynamoDBClient,
			);

			await service.batchUpdateProducts({ items });

			expect(send).toHaveBeenCalledTimes(2);
			const requestItems = (input: BatchWriteCommand['input']) =>
				input.RequestItems?.['affiliate-product-directory-pricing-TEST'] ?? [];
			expect(requestItems(send.mock.calls[0]![0].input)).toHaveLength(25);
			expect(requestItems(send.mock.calls[1]![0].input)).toHaveLength(5);
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
				{ send } as unknown as DynamoDBClient,
			);

			await expect(
				service.batchUpdateProducts({ items: [buildProduct()] }),
			).rejects.toThrow(error);
		});
	});
});
