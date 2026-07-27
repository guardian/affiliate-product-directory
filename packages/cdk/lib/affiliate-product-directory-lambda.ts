import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import type { App } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

export class AffiliateProductDirectoryLambda extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		/**
		 * A GuLambdaFunction comes with the following batteries included:
		 *   - IAM permissions to read from SSM Parameter store
		 *   - STACK, STAGE, APP environment variables
		 *
		 * @see The `__snapshots__` directory for more.
		 */
		new GuLambdaFunction(this, 'AffiliateProductDirectoryLambda', {
			/**
			 * This becomes the value of the APP tag on provisioned resources.
			 */
			app: 'affiliate-product-directory-lambda',

			/**
			 * This is the name of artifact in S3.
			 */
			fileName: 'affiliate-product-directory-lambda.zip',

			/**
			 * The format of this is `<filename>.<exported function>`.
			 *
			 * The file `packages/lambda/src/index.ts` has an exported function named `main`.
			 */
			handler: 'index.main',

			/**
			 * The runtime of the lambda function.
			 *
			 * Should align with `.nvmrc` at the root of the repository.
			 */
			runtime: Runtime.NODEJS_22_X,

			/**
			 * The architecture of the lambda function.
			 *
			 * Arm64 is preferred as it's more performant, and cheaper than x86_64.
			 *
			 * @see https://aws.amazon.com/blogs/aws/aws-lambda-functions-powered-by-aws-graviton2-processor-run-your-functions-on-arm-and-get-up-to-34-better-price-performance/
			 */
			architecture: Architecture.ARM_64,
		});
	}
}
