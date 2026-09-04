import type { PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { dynamoConfig } from './aws-config';
import type { ExtractedDirectoryProduct } from './models';

export class DynamoService {
	constructor(
		stage: string,
		private readonly pricingTableName = `affiliate-product-directory-pricing-${stage}`,
		private readonly articleTableName = `affiliate-product-directory-product-article-${stage}`,
		private readonly client = new DynamoDBClient(dynamoConfig),
	) {}

	private async saveToDb(putItemCommand: PutItemCommandInput): Promise<void> {
		try {
			await this.client.send(new PutItemCommand(putItemCommand));
		} catch (err) {
			if (err instanceof ConditionalCheckFailedException) {
				// item already exists; treat as a successful no-op
			} else {
				throw err;
			}
		}
	}

	async saveProduct({
		pricing,
		article,
	}: ExtractedDirectoryProduct): Promise<void> {
		await Promise.all([
			this.saveToDb({
				TableName: this.pricingTableName,
				Item: {
					productMerchantUrl: { S: pricing.productMerchantUrl },
					region: { S: pricing.region },
				},
				ConditionExpression: 'attribute_not_exists(productMerchantUrl)',
			}),
			this.saveToDb({
				TableName: this.articleTableName,
				Item: {
					productMerchantUrl: { S: article.productMerchantUrl },
					articleUrl: { S: article.articleUrl },
					composerArticleId: { S: article.composerArticleId ?? '' },
				},
				ConditionExpression: 'attribute_not_exists(productMerchantUrl)',
			}),
		]);
	}
}
