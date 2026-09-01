import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
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
		const command = send.mock.calls[0][0] as PutItemCommand;
		expect(command.input).toEqual({
			TableName: 'affiliate-product-directory-pricing-TEST',
			Item: {
				productMerchantUrl: { S: 'https://example.com/product' },
			},
		});
	});
});