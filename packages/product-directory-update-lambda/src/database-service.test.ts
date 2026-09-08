import type {
	DynamoDBClient,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { jest } from '@jest/globals';
import { DynamoService } from './database-service';

describe('DynamoService', () => {
	it('saves a product to the pricing and product-article tables', async () => {
		const send = jest
			.fn<(command: UpdateItemCommand) => Promise<object>>()
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
});
