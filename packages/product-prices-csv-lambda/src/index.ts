import type { DynamoDBStreamHandler } from 'aws-lambda';
import { createChangeHandler } from '@prices-csv/csv-publisher';

const handleChanges = createChangeHandler();

/** Runs when the pricing table changes, with up to a minute's changes at a time per shard. */
export const eventHandler: DynamoDBStreamHandler = async (event) => {
	await handleChanges(event.Records);
};
