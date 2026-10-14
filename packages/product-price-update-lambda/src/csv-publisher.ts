import { getConfig } from '@common/config';
import { DynamoService } from '@common/database-service';
import type { PricedProduct, Product } from '@common/models';
import type { DynamoDBStreamHandler } from 'aws-lambda';
import { S3FileWriter } from '@price-update/S3FileWriter';

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
 * Runs when the pricing table changes, with up to a minute's changes at a time. The
 * stream's records only say that something changed, so the CSV is rebuilt from the table.
 */
export const eventHandler: DynamoDBStreamHandler = async (event) => {
	console.log(
		`${event.Records.length} pricing table changes, rewriting the prices CSV`,
	);
	await publishPricesCsv();
};
