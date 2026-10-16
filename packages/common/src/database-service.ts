import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
	QueryCommand,
	ReturnValue,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
	BatchGetCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoConfig } from '@directory-update/aws-config';
import { chunk } from '@common/chunk';
import type { Product } from '@common/models';
import {
	type ExtractedDirectoryProduct,
	getArticleProductFromDynamoRecord,
} from './models';

export class DynamoService {
	constructor(
		stage: string,
		private readonly pricingTableName = `affiliate-product-directory-pricing-${stage}`,
		private readonly articleTableName = `affiliate-product-directory-product-article-${stage}`,
		private readonly client = new DynamoDBClient(dynamoConfig),
		private readonly docClient = DynamoDBDocumentClient.from(client),
	) {}

	/**
	 * Fetches all products from price table, recursing through pages until
	 * there's no LastEvaluatedKey left.
	 */
	async getAllProducts({
		lastEvaluatedKey,
	}: {
		lastEvaluatedKey?: Record<string, AttributeValue>;
	}): Promise<Product[]> {
		const response = await this.docClient.send(
			new ScanCommand({
				TableName: this.pricingTableName,
				ExclusiveStartKey: lastEvaluatedKey,
				// So every write made before the scan is included.
				ConsistentRead: true,
			}),
		);

		const items = response.Items as Product[];

		if (!response.LastEvaluatedKey) {
			return items;
		}

		const remainingItems = await this.getAllProducts({
			lastEvaluatedKey: response.LastEvaluatedKey,
		});
		return [...items, ...remainingItems];
	}

	/**
	 * Fetches the products with these URLs from the price table. Reads are strongly
	 * consistent, so a product written just before is returned as written. URLs the
	 * table doesn't have are left out.
	 */
	async getProductsByUrl(urls: string[]): Promise<Product[]> {
		// BatchGetItem takes at most 100 keys, and rejects a key asked for twice.
		const BATCH_SIZE = 100;
		const batches = chunk([...new Set(urls)], BATCH_SIZE);

		const results = await Promise.all(
			batches.map((batch) =>
				this.batchGetProducts({ urls: batch, attempt: 1 }),
			),
		);
		return results.flat();
	}

	private async batchGetProducts({
		urls,
		attempt,
	}: {
		urls: string[];
		attempt: number;
	}): Promise<Product[]> {
		const MAX_ATTEMPTS = 2;
		const resp = await this.docClient.send(
			new BatchGetCommand({
				RequestItems: {
					[this.pricingTableName]: {
						Keys: urls.map((productMerchantUrl) => ({ productMerchantUrl })),
						ConsistentRead: true,
					},
				},
			}),
		);

		const items = (resp.Responses?.[this.pricingTableName] ?? []) as Product[];
		const unprocessedUrls = (
			resp.UnprocessedKeys?.[this.pricingTableName]?.Keys ?? []
		).map((key) => key.productMerchantUrl as string);

		if (!unprocessedUrls.length) {
			return items;
		}

		if (attempt >= MAX_ATTEMPTS) {
			throw new Error(
				`${unprocessedUrls.length} item(s) still unprocessed after ${MAX_ATTEMPTS} attempts reading from ${this.pricingTableName}`,
			);
		}

		await new Promise((resolve) => setTimeout(resolve, 500));

		return [
			...items,
			...(await this.batchGetProducts({
				urls: unprocessedUrls,
				attempt: attempt + 1,
			})),
		];
	}

	async getProductPrice(
		productMerchantUrl: string,
	): Promise<Product | undefined> {
		const response = await this.docClient.send(
			new GetCommand({
				TableName: this.pricingTableName,
				Key: {
					productMerchantUrl: productMerchantUrl,
				},
			}),
		);

		return response.Item as Product | undefined;
	}

	/**
	 * Writes the items to the table, replacing each whole item. Each is written on its own,
	 * 25 at a time.
	 *
	 * With `updatedAtCutoff`, an item is only written if the one in the table was last
	 * updated before the cutoff (or never has been) and isn't marked removed. The URLs of
	 * those left alone are returned.
	 */
	async updateProducts({
		items,
		updatedAtCutoff,
	}: {
		items: Product[];
		updatedAtCutoff?: number;
	}): Promise<{ skipped: string[] }> {
		const BATCH_SIZE = 25;
		const skipped: string[] = [];

		for (const batch of chunk(items, BATCH_SIZE)) {
			const written = await Promise.all(
				batch.map((item) => this.putProduct({ item, updatedAtCutoff })),
			);
			batch.forEach((item, i) => {
				if (!written[i]) {
					skipped.push(item.productMerchantUrl);
				}
			});
		}

		return { skipped };
	}

	/** Returns whether the item was written, rather than left alone by the condition. */
	private async putProduct({
		item,
		updatedAtCutoff,
	}: {
		item: Product;
		updatedAtCutoff?: number;
	}): Promise<boolean> {
		try {
			await this.docClient.send(
				new PutCommand({
					TableName: this.pricingTableName,
					Item: item,
					...(updatedAtCutoff !== undefined && {
						ConditionExpression:
							'(attribute_not_exists(updatedAt) OR updatedAt < :updatedAtCutoff) AND (attribute_not_exists(removed) OR removed <> :removed)',
						ExpressionAttributeValues: {
							':updatedAtCutoff': updatedAtCutoff,
							':removed': 'true',
						},
					}),
				}),
			);
			return true;
		} catch (err) {
			if (err instanceof ConditionalCheckFailedException) {
				return false;
			}
			throw err;
		}
	}

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
			const articles = response.Items.map(getArticleProductFromDynamoRecord);
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
			const articles = response.Items.map(getArticleProductFromDynamoRecord);
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
