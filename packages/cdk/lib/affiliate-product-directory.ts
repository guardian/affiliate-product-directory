import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuParameter, GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb/index';
import {
	GuAllowPolicy,
	GuDynamoDBReadPolicy,
	GuDynamoDBWritePolicy,
	GuPutS3ObjectsPolicy,
} from '@guardian/cdk/lib/constructs/iam';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuS3Bucket } from '@guardian/cdk/lib/constructs/s3';
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
import { createAlarms } from './alarms';
import { connectDirectoryUpdateLambdaToCrier, createCrier } from './crier';
import { createDynamoTables } from './dynamo';
import { createLambdas } from './lambda';
import { createPolicies } from './policies';

export class AffiliateProductDirectory extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);
		const { stage } = this;

		const capiKeyParam = new GuParameter(this, 'capiKey', {
			fromSSM: true,
			default: `/${this.stage}/${this.stack}/${appName}/capi-key`,
		});
		const alarmActionsEnabled = stage === 'PROD';
		const snsTopic = new Topic(this, 'ProductDirectorySnsTopic');

		new Subscription(this, 'ProductDirectoryErrors', {
			topic: snsTopic,
			endpoint: 'thefilter.dev@guardian.co.uk',
			protocol: SubscriptionProtocol.EMAIL,
		});

		const bucket = new GuS3Bucket(this, 'ProductDirectoryBucket', {
			app: appName,
			bucketName: `${appName}-${stage.toLowerCase()}`,
		});

		const priceUpdateLambda = new GuScheduledLambda(
			this,
			'ProductPriceUpdateLambda',
			{
				app: 'product-price-update-lambda',
				fileName: 'product-price-update-lambda.zip',
				handler: 'index.eventHandler',
				environment: {
					BUCKET: bucket.bucketName,
				},
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
		const { priceUpdateLambda, directoryUpdateLambda } = createLambdas(this, {
			appName,
			stage,
			snsTopic,
			alarmActionsEnabled,
			capiKeyParam,
		});

		const { productPricingTable, productArticleTable } = createDynamoTables(
			this,
			{ stage, appName },
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

		const parameterStoreReadPolicy = new GuAllowPolicy(
			this,
			'ProductDirectoryParameterStoreReadPolicy',
			{
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: [
					`arn:aws:ssm:${this.region}:${this.account}:parameter/${stage}/frontend/${appName}/*`,
				],
			},
		);

		const s3PutPolicy = new GuPutS3ObjectsPolicy(
			this,
			'PutS3ProductDirectoryBucketObjectsPolicy',
			{
				bucketName: bucket.bucketName,
			},
		);

		const metricPutPolicy = new GuAllowPolicy(this, 'putMetric', {
			resources: ['*'],
			actions: ['cloudwatch:PutMetricData'],
		});

		const {
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			productArticleDynamoDBReadPolicy,
			productArticleDynamoDBWritePolicy,
			amazonParameterStoreReadPolicy,
			skimlinksParameterStoreReadPolicy,
		} = createPolicies(this, {
			stage,
			appName,
			productArticleTable,
			productPricingTable,
		});

		// Attach policies
		[
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			parameterStoreReadPolicy,
			s3PutPolicy,
			metricPutPolicy,
		].forEach((policy) => priceUpdateLambda.role?.attachInlinePolicy(policy));

		[
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			productArticleDynamoDBReadPolicy,
			productArticleDynamoDBWritePolicy,
			metricPutPolicy,
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

		const { crierEventBus, crierDlq } = createCrier(this, {
			appName,
			stage,
		});

		connectDirectoryUpdateLambdaToCrier(this, {
			stage,
			lambda: directoryUpdateLambda,
			eventBus: crierEventBus,
			deadLetterQueue: crierDlq,
		});

		createAlarms(this, { appName, alarmActionsEnabled, snsTopic, stage });
	}
}
