import { getConfig } from '@common/src/config';
import { appName } from '@common/src/constants';
import type { Handler } from 'aws-lambda';
import { ProductsUpdater } from '@price-update/ProductsUpdater';

export async function main(): Promise<void> {
	const { stage } = getConfig();
	const productTableName = `${appName}-pricing-${stage}`;

	console.log(`Starting price update for ${productTableName}`);
	const updater = new ProductsUpdater({ productTableName });
	await updater.refreshPrices();
	console.log('Price update complete');
}

export const eventHandler: Handler = async () => {
	await main();
};
