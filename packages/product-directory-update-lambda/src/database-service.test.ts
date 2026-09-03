import type { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { jest } from '@jest/globals';
import { DynamoService } from './database-service';

describe('DynamoService', () => {
	it('writes a product URL using the pricing table partition key', async () => {
		const send = jest
			.fn<(command: PutItemCommand) => Promise<object>>()
			.mockResolvedValue({});
		const service = new DynamoService(
			'TEST',
			'affiliate-product-directory-pricing-TEST',
			{ send } as unknown as DynamoDBClient,
		);

		await service.saveProduct({
			productMerchantUrl: 'https://example.com/product',
		});

		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls).toEqual([
			[
				expect.objectContaining({
					input: {
						TableName: 'affiliate-product-directory-pricing-TEST',
						Item: {
							productMerchantUrl: { S: 'https://example.com/product' },
						},
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
			{ send } as unknown as DynamoDBClient,
		);

		await expect(
			service.saveProduct({
				productMerchantUrl: 'https://example.com/product',
			}),
		).rejects.toThrow(error);
	});
});
