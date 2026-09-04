import type { PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
	PutItemCommand,
	QueryCommand,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { dynamoConfig } from './aws-config';
import {
	type ExtractedDirectoryProduct,
	getDirectoryArticleFromDynamoRecord,
} from './models';

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
		console.log(`Saving pricing data: ${JSON.stringify(pricing)}`);
		console.log(`Saving product-article data: ${JSON.stringify(article)}`);

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

	async getProductsInArticle(articleUrl: string): Promise<string[]> {
		const req = new QueryCommand({
			TableName: this.articleTableName,
			KeyConditionExpression: 'articleUrl = :articleUrl',
			ExpressionAttributeValues: {
				':articleUrl': { S: articleUrl },
			},
			IndexName: 'articleUrl-index',
		});

		const response = await this.client.send(req);
		if (response.Items && response.Items.length > 0) {
			const articles = response.Items.map(getDirectoryArticleFromDynamoRecord);
			return articles
				.filter((article) => !article.removed)
				.map((article) => article.productMerchantUrl);
		} else {
			return [];
		}
	}

	async getArticlesForProduct(productMerchantUrl: string): Promise<string[]> {
		const req = new QueryCommand({
			TableName: this.articleTableName,
			KeyConditionExpression: 'productMerchantUrl = :productMerchantUrl',
			ExpressionAttributeValues: {
				':productMerchantUrl': { S: productMerchantUrl },
			},
		});

		const response = await this.client.send(req);
		if (response.Items && response.Items.length > 0) {
			const articles = response.Items.map(getDirectoryArticleFromDynamoRecord);
			return articles
				.filter((article) => !article.removed)
				.map((article) => article.productMerchantUrl);
		} else {
			return [];
		}
	}

	async markPricingProductAsRemoved(productMerchantUrl: string): Promise<void> {
		await Promise.all([
			this.client.send(
				new UpdateItemCommand({
					TableName: this.pricingTableName,
					Key: {
						productMerchantUrl: { S: productMerchantUrl },
					},
					UpdateExpression:
						'SET removed = :removed, removedDate = :removedDate',
					ExpressionAttributeValues: {
						':removed': { S: 'true' },
						':removedDate': { N: Date.now().toString() },
					},
				}),
			),
		]);
	}

	async markProductAsRemovedInArticle(
		productMerchantUrl: string,
		articleUrl: string,
	): Promise<void> {
		await Promise.all([
			this.client.send(
				new UpdateItemCommand({
					TableName: this.articleTableName,
					Key: {
						productMerchantUrl: { S: productMerchantUrl },
						articleUrl: { S: articleUrl },
					},
					UpdateExpression:
						'SET removed = :removed, removedDate = :removedDate',
					ExpressionAttributeValues: {
						':removed': { S: 'true' },
						':removedDate': { N: Date.now().toString() },
					},
				}),
			),
		]);
	}
}
