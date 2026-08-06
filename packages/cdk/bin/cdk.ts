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

new AffiliateProductDirectory(
	app,
	// 'AffiliateProductDirectoryLambda-PROD',
	// {
	// 	/**
	// 	 * This becomes the value of the STACK tag on provisioned resources.
	// 	 *
	// 	 * It is also used by Riff-Raff to determine the AWS account to deploy into.
	// 	 *
	// 	 * @see https://riffraff.gutools.co.uk/deployinfo/data?key=credentials%3Aaws-cfn-role
	// 	 */
	// 	stack: 'frontend',

	// 	/**
	// 	 * This becomes the value of the STAGE tag on provisioned resources.
	// 	 */
	// 	stage: 'PROD',

	// 	env: {
	// 		/**
	// 		 * Which AWS region should this service be deployed into?
	// 		 */
	// 		region: 'eu-west-1',
	// 	},
	// },
	'AffiliateProductDirectoryLambda-CODE',
	{
		/**
		 * This becomes the value of the STACK tag on provisioned resources.
		 *
		 * It is also used by Riff-Raff to determine the AWS account to deploy into.
		 *
		 * @see https://riffraff.gutools.co.uk/deployinfo/data?key=credentials%3Aaws-cfn-role
		 */
		stack: 'frontend',
		stage: 'CODE',
		env: {
			region: 'eu-west-1',
		},
	},
);
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
