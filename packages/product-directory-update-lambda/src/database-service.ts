import {
	ConditionalCheckFailedException,
	DynamoDBClient,
	QueryCommand,
	ReturnValue,
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

	private async saveToDb(command: UpdateItemCommand): Promise<void> {
		try {
			await this.client.send(command);
		} catch (err) {
			if (err instanceof ConditionalCheckFailedException) {
				// item already exists
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
			this.saveToDb(
				// We use an Update command so we can un-soft delete entries in the same operation
				new UpdateItemCommand({
					TableName: this.pricingTableName,
					Key: {
						productMerchantUrl: { S: pricing.productMerchantUrl },
					},
					UpdateExpression:
						'SET #region = :region REMOVE #removed, #removedDate',
					ExpressionAttributeNames: {
						'#region': 'region',
						'#removed': 'removed',
						'#removedDate': 'removedDate',
					},
					ExpressionAttributeValues: {
						':region': { S: pricing.region },
						':removed': { S: 'true' },
					},
					// Only add new entries or modify entries marked as removed
					ConditionExpression:
						'attribute_not_exists(productMerchantUrl) OR #removed = :removed',
				}),
			),
			this.saveToDb(
				new UpdateItemCommand({
					TableName: this.articleTableName,
					Key: {
						productMerchantUrl: { S: article.productMerchantUrl },
						articleUrl: { S: article.articleUrl },
					},
					UpdateExpression:
						'SET #composerArticleId = :composerArticleId REMOVE #removed, #removedDate',
					ExpressionAttributeNames: {
						'#composerArticleId': 'composerArticleId',
						'#removed': 'removed',
						'#removedDate': 'removedDate',
					},
					ExpressionAttributeValues: {
						':composerArticleId': {
							S: article.composerArticleId ?? '',
						},
						':removed': { S: 'true' },
					},
					ConditionExpression:
						'attribute_not_exists(productMerchantUrl) OR #removed = :removed',
				}),
			),
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
				.map((article) => article.articleUrl);
		} else {
			return [];
		}
	}

	async markPricingProductAsRemoved(productMerchantUrl: string): Promise<void> {
		await this.client.send(
			new UpdateItemCommand({
				TableName: this.pricingTableName,
				Key: {
					productMerchantUrl: { S: productMerchantUrl },
				},
				UpdateExpression: 'SET removed = :removed, removedDate = :removedDate',
				ExpressionAttributeValues: {
					':removed': { S: 'true' },
					':removedDate': { N: Date.now().toString() },
				},
			}),
		);
	}

	async markProductAsRemovedInArticle(
		productMerchantUrl: string,
		articleUrl: string,
	): Promise<void> {
		await this.client.send(
			new UpdateItemCommand({
				TableName: this.articleTableName,
				Key: {
					productMerchantUrl: { S: productMerchantUrl },
					articleUrl: { S: articleUrl },
				},
				UpdateExpression: 'SET removed = :removed, removedDate = :removedDate',
				ExpressionAttributeValues: {
					':removed': { S: 'true' },
					':removedDate': { N: Date.now().toString() },
				},
				ReturnValues: ReturnValue.ALL_OLD,
			}),
		);
	}
}
