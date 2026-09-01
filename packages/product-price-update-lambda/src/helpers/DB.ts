import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	BatchWriteCommand,
	DynamoDBDocumentClient,
	ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME ?? ''; // replace with your actual table name / config source

export interface ProductItem {
	// replace with your actual item shape
	id: string;
	[key: string]: unknown;
}

/**
 * Fetches all items from the table, recursing through pages until
 * there's no LastEvaluatedKey left.
 */
export async function getAllItems(
	lastEvaluatedKey?: Record<string, unknown>,
): Promise<ProductItem[]> {
	const response = await docClient.send(
		new ScanCommand({
			TableName: TABLE_NAME,
			ExclusiveStartKey: lastEvaluatedKey,
		}),
	);

	const items = (response.Items as ProductItem[]) ?? [];

	if (!response.LastEvaluatedKey) {
		return items;
	}

	const remainingItems = await getAllItems(response.LastEvaluatedKey);
	return [...items, ...remainingItems];
}

/**
 * Writes a batch of items to the table, chunking into groups of 25
 * (DynamoDB's BatchWriteItem limit). No retry on unprocessed items —
 * any that fail are just dropped for now.
 */
export async function batchUpdateItems(items: ProductItem[]): Promise<void> {
	const BATCH_SIZE = 25;
	const batches = chunk(items, BATCH_SIZE);

	await Promise.all(
		batches.map((batch) =>
			docClient.send(
				new BatchWriteCommand({
					RequestItems: {
						[TABLE_NAME]: batch.map((item) => ({
							PutRequest: { Item: item },
						})),
					},
				}),
			),
		),
	);
}

/**
 * Splits an array into chunks of a given size, without a while loop.
 */
function chunk<T>(items: T[], size: number): T[][] {
	if (items.length === 0) {
		return [];
	}
	return [items.slice(0, size), ...chunk(items.slice(size), size)];
}
