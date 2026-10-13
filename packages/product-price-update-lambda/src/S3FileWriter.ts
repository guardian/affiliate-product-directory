import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getBucketName, getConfig } from '@common/config';
import { getCurrencySymbol } from '@common/currency';
import type { PricedProduct } from '@common/models';

const PRODUCT_PRICES_FILE_KEY = 'affiliates/product-prices.csv' as const;
const CACHED_PRODUCT_PRICES_FILE_KEY =
	'affiliates/cached-product-prices.json' as const;
const { stage } = getConfig();
const pathToBucket = getBucketName();

function formatCsvProduct({
	productMerchantUrl,
	currency,
	price,
}: PricedProduct): string {
	return `${productMerchantUrl},${getCurrencySymbol(currency)},${price}`;
}

export class S3FileWriter {
	constructor(private readonly s3Client = new S3Client({})) {}

	async writeToS3File({
		bucket,
		key,
		content,
		contentType,
	}: {
		bucket: string;
		key: string;
		content: string;
		contentType?: string;
	}): Promise<void> {
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: content,
				ContentType: contentType,
			}),
		);
	}

	public convertProductsToCsv(products: PricedProduct[]): string {
		return products.map(formatCsvProduct).join('\n');
	}

	/** A map of each product's URL to its whole pricing table item. */
	public convertProductsToJson(products: PricedProduct[]): string {
		return JSON.stringify(
			Object.fromEntries(
				products.map((product) => [product.productMerchantUrl, product]),
			),
		);
	}

	/**
	 * Writes the given products to two files:
	 *  - their prices as CSV, which the frontend service reads for live prices
	 *  - every field of each item as JSON, which the affiliate products tool reads
	 */
	public async writeProductsToS3Files(products: PricedProduct[]) {
		await this.writeToS3File({
			bucket: pathToBucket,
			key: `${stage}/${PRODUCT_PRICES_FILE_KEY}`,
			content: this.convertProductsToCsv(products),
		});
		await this.writeToS3File({
			bucket: pathToBucket,
			key: `${stage}/${CACHED_PRODUCT_PRICES_FILE_KEY}`,
			content: this.convertProductsToJson(products),
			contentType: 'application/json',
		});
	}
}
