import { GuAlarm } from '@guardian/cdk/lib/constructs/cloudwatch';
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
import { type App, aws_events_targets, Duration } from 'aws-cdk-lib';
import {
	ComparisonOperator,
	Metric,
	TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
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

		const snsTopic = new Topic(this, 'ProductDirectorySnsTopic');
		const alarmActionsEnabled = stage === 'PROD';

		new Subscription(this, 'ProductDirectoryErrors', {
			topic: snsTopic,
			endpoint: 'thefilter.dev@guardian.co.uk',
			protocol: SubscriptionProtocol.EMAIL,
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
					// 	// UTC time
					// 	schedule: Schedule.cron({ hour: '17', minute: '50' }),
					// 	description: `${appName} price update lambda cron`,
					// 	input: undefined,
					// },
				],
				monitoringConfiguration: {
					toleratedErrorPercentage: 1, // alarm on essentially any error
					alarmName: `${appName}-product-price-update-lambda-${stage}-alarm`,
					alarmDescription: `Something went wrong updating the products in the ${appName} product-price-update-lambda ${stage}. Check the logs`,
					snsTopicName: snsTopic.topicName,
					actionsEnabled: alarmActionsEnabled,
				},
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
				errorPercentageMonitoring: {
					toleratedErrorPercentage: 1, // alarm on essentially any error
					alarmName: `${appName}-update-lambda-${stage}-alarm`,
					alarmDescription: `Something went wrong updating the products in the ${appName} update-lambda ${stage}. Check the logs`,
					snsTopicName: snsTopic.topicName,
					actionsEnabled: alarmActionsEnabled,
				},
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

		const crierDlq = new Queue(this, 'CrierConnectionDLQ', {
			queueName: `${appName}-crier-dlq-${stage}`,
		});

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
					deadLetterQueue: crierDlq,
					maxEventAge: Duration.minutes(30),
					retryAttempts: 3,
				}),
			],
		});

		new Rule(this, 'BackfillConnection', {
			eventBus: crierEventBus,
			description: `Connect product-directory-update-lambda ${this.stage} to backfill events`,
			eventPattern: {
				source: ['backfill'],
			},
			targets: [new aws_events_targets.LambdaFunction(directoryUpdateLambda)],
		});

		const productsUpdatedMetric = new Metric({
			namespace: 'AffiliateProductDirectory',
			metricName: 'ArticleProductsUpdated',
			dimensionsMap: { Stage: stage },
			period: Duration.hours(24),
			statistic: 'Sum',
		});

		new GuAlarm(this, 'NoArticleProductsUpdatedAlarm', {
			app: appName,
			alarmName: `${appName}-no-article-products-updated-${stage}`,
			alarmDescription:
				'No article products have been updated in the last 24 hours',
			metric: productsUpdatedMetric,
			comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
			threshold: 0,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.BREACHING,
			snsTopicName: snsTopic.topicName,
			actionsEnabled: alarmActionsEnabled,
		});

		const skimlinksProductsFetchedMetric = new Metric({
			namespace: 'AffiliateProductDirectory',
			metricName: 'SkimlinksProductsFetched',
			dimensionsMap: { Stage: stage },
			period: Duration.hours(24),
			statistic: 'Sum',
		});

		new GuAlarm(this, 'NoSkimlinksProductsFetchedAlarm', {
			app: appName,
			alarmName: `${appName}-no-skimlinks-products-fetched-${stage}`,
			alarmDescription:
				'No skimlinks products have been fetched in the last 24 hours',
			metric: skimlinksProductsFetchedMetric,
			comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
			threshold: 0,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.BREACHING,
			snsTopicName: snsTopic.topicName,
			actionsEnabled: alarmActionsEnabled,
		});

		const amazonProductsFetchedMetric = new Metric({
			namespace: 'AffiliateProductDirectory',
			metricName: 'AmazonProductsFetched',
			dimensionsMap: { Stage: stage },
			period: Duration.hours(24),
			statistic: 'Sum',
		});

		new GuAlarm(this, 'NoAmazonProductsFetchedAlarm', {
			app: appName,
			alarmName: `${appName}-no-amazon-products-fetched-${stage}`,
			alarmDescription:
				'No amazon products have been fetched in the last 24 hours',
			metric: amazonProductsFetchedMetric,
			comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
			threshold: 0,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.BREACHING,
			snsTopicName: snsTopic.topicName,
			actionsEnabled: alarmActionsEnabled,
		});
	}
}
