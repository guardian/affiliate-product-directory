import {
	GetObjectCommand,
	S3Client,
	S3ServiceException,
} from '@aws-sdk/client-s3';
import type { ArticlesPage } from '@common/tool-models';
import {
	CachedProductPricesSchema,
	type GetProductPrices,
	type ProductPrices,
} from './types';

/** Whether S3 turned down a read because the file still has the ETag the read was given. */
const isNotModified = (error: unknown) =>
	error instanceof S3ServiceException && error.$metadata.httpStatusCode === 304;

/**
 * Reads the cached prices file from S3, keeping the whole parsed file in memory so that
 * warm invocations of a Lambda instance reuse it. Each call asks S3 for the file only if
 * it has changed since the copy in memory was read, which S3 tells from the file's ETag.
 */
export function createProductPrices({
	bucket,
	key,
	s3Client = new S3Client({ region: 'eu-west-1' }),
}: {
	bucket: string;
	key: string;
	s3Client?: S3Client;
}): GetProductPrices {
	let cached: { prices: ProductPrices; etag: string | undefined } | undefined;
	// Shared by the requests that arrive while S3 is being asked.
	let reading: Promise<ProductPrices> | undefined;

	const readIfChanged = async (): Promise<ProductPrices> => {
		try {
			const { Body, ETag } = await s3Client.send(
				new GetObjectCommand({
					Bucket: bucket,
					Key: key,
					IfNoneMatch: cached?.etag,
				}),
			);
			if (!Body) {
				throw new Error(`s3://${bucket}/${key} has no content`);
			}

			// Throws if the file isn't the shape the tool relies on.
			const file = CachedProductPricesSchema.parse(
				JSON.parse(await Body.transformToString()),
			);
			cached = { prices: new Map(Object.entries(file)), etag: ETag };
			return cached.prices;
		} catch (error) {
			if (!cached) {
				throw error;
			}
			if (!isNotModified(error)) {
				console.error(
					'Could not read the cached product prices again, so the last copy is being used',
					error,
				);
			}
			return cached.prices;
		}
	};

	return () => {
		reading ??= readIfChanged().finally(() => {
			reading = undefined;
		});
		return reading;
	};
}

/** Adds the directory's price to each of the articles' products that it has one for. */
export const attachProductPrices = (
	page: ArticlesPage,
	prices: ProductPrices,
): ArticlesPage => ({
	...page,
	articles: page.articles.map((article) => ({
		...article,
		products: article.products.map((product) => ({
			...product,
			...prices.get(product.url),
		})),
	})),
});
