import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	BatchWriteCommand,
	DynamoDBDocumentClient,
	ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Fetches all items from a table, recursing through pages until
 * there's no LastEvaluatedKey left.
 */
export async function getAllItems<T>({
	tableName,
	lastEvaluatedKey,
}: {
	tableName: string;
	lastEvaluatedKey?: Record<string, unknown>;
}): Promise<T[]> {
	const response = await docClient.send(
		new ScanCommand({
			TableName: tableName,
			ExclusiveStartKey: lastEvaluatedKey,
		}),
	);

	const items = response.Items as T[];

	if (!response.LastEvaluatedKey) {
		return items;
	}

	const remainingItems = await getAllItems<T>({
		tableName: tableName,
		lastEvaluatedKey: response.LastEvaluatedKey,
	});
	return [...items, ...remainingItems];
}

/**
 * Writes a batch of items to the table, chunking into groups of 25
 * (DynamoDB's BatchWriteItem limit). No retry on unprocessed items —
 * any that fail are just dropped for now.
 */
export async function batchUpdateItems({
	items,
	tableName,
}: {
	items: object[];
	tableName: string;
}): Promise<void> {
	const BATCH_SIZE = 25;
	const batches = chunk(items, BATCH_SIZE);

	await Promise.all(
		batches.map((batch) =>
			docClient.send(
				new BatchWriteCommand({
					RequestItems: {
						[tableName]: batch.map((item) => ({
							PutRequest: { Item: item as Record<string, unknown> },
						})),
					},
				}),
			),
		),
	);
}

/**
 * Splits an array into chunks of a given size.
 */
function chunk<T>(items: T[], size: number): T[][] {
	if (items.length === 0) {
		return [];
	}
	return [items.slice(0, size), ...chunk(items.slice(size), size)];
}
