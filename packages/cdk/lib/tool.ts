import { GuCertificate } from '@guardian/cdk/lib/constructs/acm';
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuApiLambda } from '@guardian/cdk/lib/patterns/api-lambda';
import { Duration } from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

const app = 'affiliate-products-tool';

/**
 * The affiliate products tool: one Lambda (affiliate-products-server) serving both the
 * client app and its API from a single origin, behind API Gateway on a custom domain.
 */
export function createTool(
	scope: GuStack,
	{ domainName }: { domainName: string },
): GuApiLambda {
	// dev-gutools.co.uk isn't in Route 53, so the first deploy waits until the
	// certificate's DNS validation record has been added manually.
	const certificate = new GuCertificate(scope, { app, domainName });

	const toolLambda = new GuApiLambda(scope, 'AffiliateProductsTool', {
		app,
		fileName: `${app}.zip`,
		handler: 'index.handler',
		runtime: Runtime.NODEJS_22_X,
		architecture: Architecture.ARM_64,
		monitoringConfiguration: { noMonitoring: true },
		api: {
			id: 'AffiliateProductsToolApi',
			// Rate limits every route here rather than in Express, where limits would only
			// apply per Lambda instance. Sized for an internal tool with a handful of users.
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

	new GuCname(scope, 'AffiliateProductsToolCname', {
		app,
		domainName,
		// Always set, as the API is given a domainName above.
		resourceRecord: toolLambda.api.domainName!.domainNameAliasDomainName,
		ttl: Duration.hours(1),
	});

	return toolLambda;
}
