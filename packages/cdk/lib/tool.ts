import { GuCertificate } from '@guardian/cdk/lib/constructs/acm';
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuApiLambda } from '@guardian/cdk/lib/patterns/api-lambda';
import { type CfnParameter, Duration } from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';
import { Effect, type Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { attachPoliciesToLambda } from './lambda';

const app = 'affiliate-products-tool';

/**
 * The affiliate products tool: one Lambda (affiliate-products-server) serving both the
 * client app and its API from a single origin, behind API Gateway on a custom domain.
 */
export function createTool(
	scope: GuStack,
	{
		domainName,
		capiKeyParam,
		productPricingReadPolicy,
		productPricingWritePolicy,
		prodData,
	}: {
		domainName: string;
		capiKeyParam: CfnParameter;
		productPricingReadPolicy: Policy;
		productPricingWritePolicy: Policy;
		/** PROD's CAPI key and pricing table, for a stage other than PROD to also list PROD's articles and prices. */
		prodData?: {
			capiKeyParam: CfnParameter;
			pricingTableName: string;
			editPricesParameterName: string;
		};
	},
): GuApiLambda {
	// Neither dev-gutools.co.uk nor gutools.co.uk is in Route 53, so the first deploy
	// waits until the certificate's DNS validation record has been added manually.
	const certificate = new GuCertificate(scope, { app, domainName });

	const toolLambda = new GuApiLambda(scope, 'AffiliateProductsTool', {
		app,
		fileName: `${app}.zip`,
		handler: 'index.handler',
		environment: {
			CAPI_KEY: capiKeyParam.valueAsString,
			...(prodData && {
				PROD_CAPI_KEY: prodData.capiKeyParam.valueAsString,
				EDIT_PROD_PRICES_PARAMETER: prodData.editPricesParameterName,
			}),
		},
		runtime: Runtime.NODEJS_22_X,
		architecture: Architecture.ARM_64,
		monitoringConfiguration: { noMonitoring: true },
		api: {
			id: 'AffiliateProductsToolApi',
			deployOptions: {
				throttlingRateLimit: 20,
				throttlingBurstLimit: 50,
			},
			// Lets the Lambda return binary files such as the favicon. Only responses the
			// Lambda base64-encodes are converted, so text responses are unaffected.
			binaryMediaTypes: ['*/*'],
			endpointConfiguration: { types: [EndpointType.REGIONAL] },
			domainName: {
				domainName,
				certificate,
				endpointType: EndpointType.REGIONAL,
			},
		},
	});

	// The public key for checking Panda cookies for Auth. verification.
	toolLambda.addToRolePolicy(
		new PolicyStatement({
			actions: ['s3:GetObject'],
			resources: ['arn:aws:s3:::pan-domain-auth-settings/*.settings.public'],
		}),
	);

	// Users' permissions, as cached by the permissions service.
	toolLambda.addToRolePolicy(
		new PolicyStatement({
			actions: ['s3:GetObject'],
			resources: [`arn:aws:s3:::permissions-cache/${scope.stage}/*`],
		}),
	);

	// The Skimlinks merchants' domains, written by skimlinks-lambda, for counting the links
	// in articles that are sent through Skimlinks.
	toolLambda.addToRolePolicy(
		new PolicyStatement({
			actions: ['s3:GetObject'],
			resources: [
				'arn:aws:s3:::gu-skimlinks-store/skimlinks/skimlinks-domains.csv',
			],
		}),
	);

	// The products' prices, read from the pricing table on every request, and written to it.
	attachPoliciesToLambda(toolLambda, [
		productPricingReadPolicy,
		productPricingWritePolicy,
	]);

	if (prodData) {
		const prodPricingTableArn = `arn:aws:dynamodb:${scope.region}:${scope.account}:table/${prodData.pricingTableName}`;
		// The tool reads prices with BatchGetItem, and sets them by hand with GetItem and
		// PutItem, which the server only does while the switch for it is on.
		const prodPricingActions = [
			'dynamodb:BatchGetItem',
			'dynamodb:GetItem',
			'dynamodb:PutItem',
		];

		toolLambda.addToRolePolicy(
			new PolicyStatement({
				actions: prodPricingActions,
				resources: [prodPricingTableArn],
			}),
		);

		// An explicit deny overrides any allow, so no other policy on this role can let it do
		// anything else to PROD's pricing table, such as deleting items or changing the table.
		toolLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.DENY,
				notActions: prodPricingActions,
				resources: [prodPricingTableArn, `${prodPricingTableArn}/*`],
			}),
		);

		// The switch for setting PROD's prices by hand. It isn't created here, so it's off
		// until someone adds it.
		toolLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['ssm:GetParameter'],
				resources: [
					`arn:aws:ssm:${scope.region}:${scope.account}:parameter${prodData.editPricesParameterName}`,
				],
			}),
		);
	}

	new GuCname(scope, 'AffiliateProductsToolCname', {
		app,
		domainName,
		resourceRecord: toolLambda.api.domainName!.domainNameAliasDomainName,
		ttl: Duration.hours(1),
	});

	return toolLambda;
}
