import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuParameter, GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb/index';
import {
	GuAllowPolicy,
	GuDynamoDBReadPolicy,
	GuDynamoDBWritePolicy,
} from '@guardian/cdk/lib/constructs/iam';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuScheduledLambda } from '@guardian/cdk/lib/patterns/scheduled-lambda';
import { type App, aws_events_targets } from 'aws-cdk-lib';
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { appName } from '../../common/src/constants';
import { CrierEventbridge } from './crier-eventbridge';

export class AffiliateProductDirectory extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);
		const { stage } = this;

		const capiKeyParam = new GuParameter(this, 'capiKey', {
			fromSSM: true,
			default: `/${this.stage}/${this.stack}/${appName}/capi-key`,
		});

		const priceUpdateLambda = new GuScheduledLambda(
			this,
			'ProductPriceUpdateLambda',
			{
				app: 'product-price-update-lambda',
				fileName: 'product-price-update-lambda.zip',
				handler: 'index.eventHandler',
				runtime: Runtime.NODEJS_22_X,
				architecture: Architecture.ARM_64,
				// Used for defining cron job execution
				rules: [
					// {
					// 	schedule: Schedule.cron({ minute: '0', hour: '2' }),
					// 	description: 'Product price update lambda',
					// 	input: undefined,
					// },
				],
				// ToDo: we should add monitoring as part of observability and alarming
				monitoringConfiguration: { noMonitoring: true },
			},
		);

		const directoryUpdateLambda = new GuLambdaFunction(
			this,
			'ProductDirectoryUpdateLambda',
			{
				app: 'product-directory-update-lambda',
				fileName: 'product-directory-update-lambda.zip',
				handler: 'index.eventHandler',
				environment: {
					CAPI_KEY: capiKeyParam.valueAsString,
				},
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

		const skimlinksParameterStoreReadPolicy = new GuAllowPolicy(
			this,
			'SkimlinksParameterStoreReadPolicy',
			{
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: [
					`arn:aws:ssm:${this.region}:${this.account}:parameter/CODE/frontend/${appName}/skimlinks/*`,
				],
			},
		);

		[
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			skimlinksParameterStoreReadPolicy,
		].forEach((policy) => priceUpdateLambda.role?.attachInlinePolicy(policy));

		[
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			productArticleDynamoDBReadPolicy,
			productArticleDynamoDBWritePolicy,
		].forEach((policy) =>
			directoryUpdateLambda.role?.attachInlinePolicy(policy),
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

		new CrierEventbridge(this, 'Crier');

		const eventBusParam = new GuParameter(this, 'EventBus', {
			fromSSM: true,
			default: `/${this.stage}/frontend/frontend-shared-infra/crier-event-bus`,
		});

		const crierEventBus = EventBus.fromEventBusName(
			this,
			'CrierEventBus',
			eventBusParam.valueAsString,
		);

		new Rule(this, 'CrierConnection', {
			eventBus: crierEventBus,
			description: `Connect product-directory-update-lambda ${this.stage} to Crier`,
			eventPattern: {
				source: ['crier'],
				detailType: [
					'content-update',
					'content-delete',
					'content-retrievableupdate',
				],
			},
			targets: [
				new aws_events_targets.LambdaFunction(directoryUpdateLambda, {
					// ToDo: do we want a DLQ?
				}),
			],
		});

		new Rule(this, 'BackfillConnection', {
			eventBus: crierEventBus,
			description: `Connect product-directory-update-lambda ${this.stage} to backfill events`,
			eventPattern: {
				source: ['backfill'],
			},
			targets: [
				new aws_events_targets.LambdaFunction(directoryUpdateLambda, {
					// ToDo: do we want a DLQ?
				}),
			],
		});
	}
}
