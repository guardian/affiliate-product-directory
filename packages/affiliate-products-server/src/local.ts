import { getCapiBaseUrl, getCapiKey } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createCapiArticles, getComposerBaseUrl } from './capi';
import { createProductPrices } from './productPrices';
import type { Auth, GetProductPrices, ProductPrices } from './types';

const port = 3040;

// The CAPI and Composer stage to use locally.
const stage = 'CODE';

// The Panda cookie is only sent to *.dev-gutools.co.uk, never to localhost, so every
// request is treated as coming from this user. The Lambda entry point (index.ts) never uses this.
const localAuth: Auth = {
	authenticate: () =>
		Promise.resolve({
			email: 'local.user@guardian.co.uk',
			firstName: 'Local',
			lastName: 'User',
		}),
	hasAccess: () => Promise.resolve(true),
	listPermissions: () => Promise.resolve(['local_permission']),
	loginUrl: '',
};

// Run with CAPI_KEY set to a CAPI key for that stage.
const listArticles = createCapiArticles({
	baseUrl: getCapiBaseUrl(stage),
	apiKey: getCapiKey(),
	composerBaseUrl: getComposerBaseUrl(stage),
});

// The prices of the same stage as the articles, as each stage's directory is built from its CAPI.
const dynamoService = new DynamoService(stage);
const readProductPrices = createProductPrices((urls) =>
	dynamoService.getProductsByUrl(urls),
);

// Reading the table needs AWS credentials for the frontend account. Without them the
// articles are still listed, but with no prices. The Lambda entry point fails instead.
const getProductPrices: GetProductPrices = (urls) =>
	readProductPrices(urls).catch((error: unknown): ProductPrices => {
		console.warn('Listing articles without prices, as they could not be read');
		console.warn(error);
		return new Map();
	});

createApp({
	clientDir: '../affiliate-products-client/build',
	auth: localAuth,
	listArticles,
	getProductPrices,
}).listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
