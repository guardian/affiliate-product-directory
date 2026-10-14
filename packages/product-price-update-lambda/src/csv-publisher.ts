import { getConfig } from '@common/config';
import { DynamoService } from '@common/database-service';
import type { PricedProduct, Product } from '@common/models';
import type { DynamoDBRecord, DynamoDBStreamHandler } from 'aws-lambda';
import { S3FileWriter } from '@price-update/S3FileWriter';

// Stream timestamps are rounded down to the second and come from DynamoDB's clock, not
// this lambda's. Must stay well under the stream's 1-minute batching window, or the extra
// batches after a price run would no longer be skipped.
const CLOCK_MARGIN_MS = 5_000;

/** The products the CSV lists: those still in the directory that have a price. */
const isPublishable = (product: Product): product is PricedProduct =>
	product.removed !== 'true' &&
	product.price !== undefined &&
	product.currency !== undefined;

/** Rewrites the prices CSV from the whole pricing table. */
export async function publishPricesCsv(): Promise<void> {
	const { stage } = getConfig();
	const products = await new DynamoService(stage).getAllProducts({});
	const publishable = products.filter(isPublishable);

	await new S3FileWriter().writeProductsToS3File(publishable);
	console.log(`Wrote ${publishable.length} product prices to the CSV`);
}

/**
 * Handles a batch of pricing table changes. The stream's records only say that something
 * changed, so the CSV is rebuilt from the table.
 *
 * Lambda batches each stream shard separately, so one burst of writes, like a price run,
 * arrives as several batches, handled one after another. Once one of them has rewritten
 * the CSV, the rest are skipped if every change in them was made before that rewrite
 * started reading the table.
 *
 * When that read started is kept in memory, so a new lambda instance always rewrites. That
 * costs an extra rewrite but never misses a change. It relies on the lambda running one
 * invocation at a time, so the CSV in S3 was read no earlier than the time remembered here.
 */
export function createChangeHandler() {
	let lastReadStartedAt: number | undefined;

	return async (records: DynamoDBRecord[]): Promise<void> => {
		// A record without a timestamp counts as a change made now.
		const newestChangeAt = Math.max(
			...records.map(
				(record) =>
					(record.dynamodb?.ApproximateCreationDateTime ?? Infinity) * 1000,
			),
		);
		if (
			lastReadStartedAt !== undefined &&
			newestChangeAt + CLOCK_MARGIN_MS < lastReadStartedAt
		) {
			console.log(
				`The prices CSV already includes these ${records.length} pricing table changes, skipping`,
			);
			return;
		}

		console.log(
			`${records.length} pricing table changes, rewriting the prices CSV`,
		);
		const readStartedAt = Date.now();
		await publishPricesCsv();
		lastReadStartedAt = readStartedAt;
	};
}

const handleChanges = createChangeHandler();

/** Runs when the pricing table changes, with up to a minute's changes at a time per shard. */
export const eventHandler: DynamoDBStreamHandler = async (event) => {
	await handleChanges(event.Records);
};
