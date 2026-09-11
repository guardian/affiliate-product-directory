import { getConfig } from '@common/config';
import { appName } from '@common/constants';
import { DynamoService } from '@common/database-service';
import type { Handler } from 'aws-lambda';
import { ProductsUpdater } from '@price-update/ProductsUpdater';

export async function main(): Promise<void> {
	const { stage } = getConfig();
	const productTableName = `${appName}-pricing-${stage}`;
	const dynamoService = new DynamoService(stage);

	console.log(`Starting price update for ${productTableName}`);
	const updater = new ProductsUpdater(dynamoService);
	await updater.refreshPrices();
	console.log('Price update complete');
}

export const eventHandler: Handler = async () => {
	await main();
};
