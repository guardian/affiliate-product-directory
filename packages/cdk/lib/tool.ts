import { GuCertificate } from '@guardian/cdk/lib/constructs/acm';
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuCname } from '@guardian/cdk/lib/constructs/dns';
import { GuApiLambda } from '@guardian/cdk/lib/patterns/api-lambda';
import { Duration } from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';
import { type Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
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
		policies,
	}: {
		domainName: string;
		/** Policies attached to the tool Lambda's role. */
		policies: Policy[];
	},
): GuApiLambda {
	// Neither dev-gutools.co.uk nor gutools.co.uk is in Route 53, so the first deploy
	// waits until the certificate's DNS validation record has been added manually.
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
			// The API's only rate limit, applied across every Lambda instance. Per-IP limits
			// would need WAF.
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

	attachPoliciesToLambda(toolLambda, policies);

	// This parameter is consumed by https://github.com/guardian/waf.
	new StringParameter(scope, 'ApiGatewaySsmParam', {
		parameterName: `/infosec/waf/services/${scope.stage}/${app}-api-gateway-arn`,
		description: `The ARN of the API Gateway for ${app}-${scope.stage}. This parameter is created via CDK.`,
		stringValue: toolLambda.api.deploymentStage.stageArn,
	});

	new GuCname(scope, 'AffiliateProductsToolCname', {
		app,
		domainName,
		resourceRecord: toolLambda.api.domainName!.domainNameAliasDomainName,
		ttl: Duration.hours(1),
	});

	return toolLambda;
}
