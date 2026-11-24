import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createSkimlinksDomains } from './skimlinksDomains';
import type { Auth } from './types';

// PORT lets a second copy run alongside one already on 3040.
const port = Number(process.env.PORT ?? 3040);

// The CAPI and Composer stage to use locally.
const stage = 'CODE';

// The price providers read their credentials from this stack's parameters, as the Lambda does.
process.env.STACK ??= 'frontend';
process.env.STAGE ??= stage;
process.env.APP ??= 'affiliate-products-tool';

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

// Run with AWS credentials for the frontend account to read the stage's CAPI key from
// Parameter Store, the tables and the Skimlinks domains. The prices are from the same stage as the articles, as each
// stage's directory is built from its CAPI.
createApp({
	clientDir: '../affiliate-products-client/build',
	auth: localAuth,
	stage,
	dynamoService: new DynamoService(stage),
	readSkimlinksDomains: createSkimlinksDomains(),
}).listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
