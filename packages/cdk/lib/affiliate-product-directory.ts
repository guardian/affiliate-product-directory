import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuParameter, GuStack } from '@guardian/cdk/lib/constructs/core';
import type { App } from 'aws-cdk-lib';
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
			skimlinksParameterStoreReadPolicy,
			amazonParameterStoreReadPolicy,
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
