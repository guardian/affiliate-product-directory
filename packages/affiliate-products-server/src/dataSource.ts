import { getCapiBaseUrl } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createCapiArticles, getComposerBaseUrl } from './capi';
import { createProductPrices } from './productPrices';
import type { DataSource } from './types';

/**
 * Lists a stage's articles from its CAPI, linking to its Composer, and reads their prices
 * from its pricing table on every request, so nothing is cached between them.
 */
export const createDataSource = (
	stage: string,
	capiKey: string,
): DataSource => {
	const dynamoService = new DynamoService(stage);
	return {
		listArticles: createCapiArticles({
			baseUrl: getCapiBaseUrl(stage),
			apiKey: capiKey,
			composerBaseUrl: getComposerBaseUrl(stage),
		}),
		getProductPrices: createProductPrices((urls) =>
			dynamoService.getProductsByUrl(urls),
		),
	};
};
