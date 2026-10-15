import { getCapiKey } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import type { Auth } from './types';

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

// Also set PROD_CAPI_KEY to a PROD CAPI key to be able to list PROD's articles and prices.
const prodCapiKey = process.env.PROD_CAPI_KEY;

// Run with CAPI_KEY set to a CAPI key for that stage, and AWS credentials for the frontend
// account to read the tables. The prices are from the same stage as the articles, as each
// stage's directory is built from its CAPI.
createApp({
	clientDir: '../affiliate-products-client/build',
	auth: localAuth,
	stage,
	capiKey: getCapiKey(),
	dynamoService: new DynamoService(stage),
	prod: prodCapiKey
		? { capiKey: prodCapiKey, dynamoService: new DynamoService('PROD') }
		: undefined,
}).listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
