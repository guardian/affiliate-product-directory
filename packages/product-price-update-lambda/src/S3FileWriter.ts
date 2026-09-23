import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getBucketName } from '@common/config';
import { formatPrice, getCurrencySymbol } from '@common/format';
import type { Product } from '@common/models';

const PRODUCT_PRICES_FILE_KEY = 'product-prices.csv' as const;
const pathToBucket = getBucketName();

function formatCsvProduct({
	productMerchantUrl,
	currency,
	price,
}: Product): string {
	return `${productMerchantUrl},${getCurrencySymbol(currency)}${formatPrice(price)}`;
}

export class S3FileWriter {
	constructor(private readonly s3Client = new S3Client({})) {}

	async writeToS3File({
		bucket,
		key,
		content,
	}: {
		bucket: string;
		key: string;
		content: string;
	}): Promise<void> {
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: content,
			}),
		);
	}

	public convertProductsToCsv(products: Product[]): string {
		return products.map(formatCsvProduct).join('\n');
	}

	public async writeProductsToS3File(products: Product[]) {
		await this.writeToS3File({
			bucket: pathToBucket,
			key: PRODUCT_PRICES_FILE_KEY,
			content: this.convertProductsToCsv(products),
		});
	}
}
