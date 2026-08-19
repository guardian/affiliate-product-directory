import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { AffiliateProductDirectory } from '../lib/affiliate-product-directory';
import { FrontendAccountEventbridgeConnection } from '../lib/capi-side-eventbridge-config';
/**
 * GuRootExperimental will generate a `riff-raff.yaml` configuration file to deploy this project with Riff-Raff.
 *
 * @see https://github.com/guardian/cdk/blob/main/src/experimental/riff-raff-yaml-file/README.md
 */
const app = new GuRoot();

new AffiliateProductDirectory(app, 'AffiliateProductDirectoryLambda-CODE', {
	stack: 'frontend',
	stage: 'CODE',
	env: {
		region: 'eu-west-1',
	},
	app: 'affiliate-product-directory',
});
new AffiliateProductDirectory(app, 'AffiliateProductDirectoryLambda-PROD', {
	stack: 'frontend',
	stage: 'PROD',
	env: {
		region: 'eu-west-1',
	},
	app: 'affiliate-product-directory',
});

new FrontendAccountEventbridgeConnection(
	app,
	'FrontendAccountEventbridgeConnection-euwest-1-CODE',
	{
		stack: 'content-api',
		stage: 'CODE',
		env: { region: 'eu-west-1' },
		app: 'frontend-crier-infra',
	},
);

// Deploy in a separate PR to avoid chicken and egg arn scenario
// new FrontendAccountEventbridgeConnection(
// 	app,
// 	'FrontendAccountEventbridgeConnection-euwest-1-PROD',
// 	{
// 		stack: 'content-api',
// 		stage: 'PROD',
// 		env: { region: 'eu-west-1' },
// 		app: 'frontend-crier-infra',
// 	},
// );
