import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoConfig } from './aws-config';
import type { DirectoryProduct } from './models';

export class DynamoService {
	constructor(
		stage: string,
		private readonly tableName = `affiliate-product-directory-pricing-${stage}`,
		private readonly client = new DynamoDBClient(dynamoConfig),
	) {}

	async saveProduct({ productMerchantUrl }: DirectoryProduct): Promise<void> {
		await this.client.send(
			new PutItemCommand({
				TableName: this.tableName,
				Item: {
					productMerchantUrl: { S: productMerchantUrl },
				},
			}),
		);
	}
}
