import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb/index';
import {
	GuDynamoDBReadPolicy,
	GuDynamoDBWritePolicy,
} from '@guardian/cdk/lib/constructs/iam';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { type App, aws_events_targets } from 'aws-cdk-lib';
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class AffiliateProductDirectory extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);
		const { stage } = this;
		const appName = 'affiliate-product-directory';

		/**
		 * A GuLambdaFunction comes with the following batteries included:
		 *   - IAM permissions to read from SSM Parameter store
		 *   - STACK, STAGE, APP environment variables
		 *
		 * @see The `__snapshots__` directory for more.
		 */
		const priceUpdateLambda = new GuLambdaFunction(
			this,
			'ProductPriceUpdateLambda',
			{
				/**
				 * This becomes the value of the APP tag on provisioned resources.
				 */
				app: 'product-price-update-lambda',

				/**
				 * This is the name of artifact in S3.
				 */
				fileName: 'product-price-update-lambda.zip',

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
			},
		);

		const directoryUpdateLambda = new GuLambdaFunction(
			this,
			'ProductDirectoryUpdateLambda',
			{
				app: 'product-directory-update-lambda',
				fileName: 'product-directory-update-lambda.zip',
				handler: 'index.main',
				runtime: Runtime.NODEJS_22_X,
				architecture: Architecture.ARM_64,
			},
		);

		const productPricingTable = new GuDynamoTable(
			this,
			'ProductDirectoryPricingTable',
			{
				billingMode: BillingMode.PAY_PER_REQUEST,
				devXBackups: { enabled: true },
				partitionKey: {
					name: 'productMerchantUrl',
					type: AttributeType.STRING,
				},
				tableName: `${appName}-pricing-${stage}`,
			},
		);

		const productArticleTable = new GuDynamoTable(
			this,
			'ProductDirectoryProductArticleTable',
			{
				billingMode: BillingMode.PAY_PER_REQUEST,
				devXBackups: { enabled: true },
				partitionKey: {
					name: 'productMerchantUrl',
					type: AttributeType.STRING,
				},
				sortKey: {
					name: 'articleUrl',
					type: AttributeType.STRING,
				},
				tableName: `${appName}-product-article-${stage}`,
			},
		);

		productArticleTable.addGlobalSecondaryIndex({
			indexName: 'articleUrl-index',
			partitionKey: {
				name: 'articleUrl',
				type: AttributeType.STRING,
			},
		});

		const productPricingDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
			this,
			'ProductPricingDynamoReadPolicy',
			{
				tableName: productPricingTable.tableName,
			},
		);

		const productPricingDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
			this,
			'ProductPricingDynamoWritePolicy',
			{
				tableName: productPricingTable.tableName,
			},
		);

		const productArticleDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
			this,
			'ProductArticleDynamoReadPolicy',
			{
				tableName: productArticleTable.tableName,
			},
		);

		const productArticleDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
			this,
			'ProductArticleDynamoWritePolicy',
			{
				tableName: productArticleTable.tableName,
			},
		);

		priceUpdateLambda.role?.attachInlinePolicy(
			productPricingDynamoDBReadPolicy,
		);
		priceUpdateLambda.role?.attachInlinePolicy(
			productPricingDynamoDBWritePolicy,
		);

		directoryUpdateLambda.role?.attachInlinePolicy(
			productPricingDynamoDBReadPolicy,
		);
		directoryUpdateLambda.role?.attachInlinePolicy(
			productPricingDynamoDBWritePolicy,
		);
		directoryUpdateLambda.role?.attachInlinePolicy(
			productArticleDynamoDBReadPolicy,
		);
		directoryUpdateLambda.role?.attachInlinePolicy(
			productArticleDynamoDBWritePolicy,
		);

		const updatedPriceQueue = new Queue(this, 'ProductPricingUpdateQueue', {
			queueName: `${appName}-pricing-update-${this.stage}`,
			// TODO: determine what other params we need
			//visibilityTimeout: Duration.minutes(10),
			// deadLetterQueue: {
			// 	queue: backfillDLQ,
			// 	maxReceiveCount: 3,
			// },
		});
		updatedPriceQueue.grantSendMessages(priceUpdateLambda);

		const crierEventBus = EventBus.fromEventBusName(
			this,
			'CrierEventBus',
			`crier-eventbus-content-api-crier-v2-${this.stage}`,
		);

		new Rule(this, 'CrierConnection', {
			eventBus: crierEventBus,
			description: `Connect product-directory-update-lambda ${this.stage} to Crier`,
			eventPattern: { source: ['crier'] },
			targets: [
				new aws_events_targets.LambdaFunction(directoryUpdateLambda, {
					// ToDo: do we want a DLQ?
				}),
			],
		});
	}
}
