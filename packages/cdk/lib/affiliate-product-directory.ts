import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuParameter, GuStack } from '@guardian/cdk/lib/constructs/core';
import { type App, Duration } from 'aws-cdk-lib';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { appName } from '../../common/src/constants';
import { createAlarms } from './alarms';
import { connectDirectoryUpdateLambdaToCrier, createCrier } from './crier';
import { createDynamoTables } from './dynamo';
import { attachPoliciesToLambda, createLambdas } from './lambda';
import { createPolicies } from './policies';
import { createTool } from './tool';

interface AffiliateProductDirectoryProps extends GuStackProps {
	/** The affiliate products tool is only created in stages given a domain for it. */
	toolDomainName?: string;
}

export class AffiliateProductDirectory extends GuStack {
	constructor(scope: App, id: string, props: AffiliateProductDirectoryProps) {
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

		const bucketName = 'aws-frontend-store';

		const { priceUpdateLambda, pricesCsvLambda, directoryUpdateLambda } =
			createLambdas(this, {
				appName,
				stage,
				snsTopic,
				alarmActionsEnabled,
				capiKeyParam,
				bucketName,
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
			parameterStoreReadPolicy,
			metricPutPolicy,
			s3PutPolicy,
		} = createPolicies(this, {
			stage,
			appName,
			productArticleTable,
			productPricingTable,
			region: this.region,
			account: this.account,
			bucketName,
		});

		// Attach policies
		attachPoliciesToLambda(priceUpdateLambda, [
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			parameterStoreReadPolicy,
			metricPutPolicy,
		]);

		attachPoliciesToLambda(pricesCsvLambda, [
			productPricingDynamoDBReadPolicy,
			s3PutPolicy,
		]);

		// Collects up to a minute's changes to the pricing table, then rewrites the CSV. Each
		// stream shard is batched separately, so a burst of writes arrives as several batches;
		// csv-publisher.ts skips those an earlier rewrite already covered, which relies on the
		// minute's wait. Adding the event source also lets the lambda read the table's stream.
		pricesCsvLambda.addEventSource(
			new DynamoEventSource(productPricingTable, {
				// A new or updated mapping can take minutes to start polling, and LATEST would
				// skip changes made meanwhile. Replaying the stream's last 24 hours instead is
				// harmless, as the CSV is rebuilt from the table, not from the records.
				startingPosition: StartingPosition.TRIM_HORIZON,
				batchSize: 10_000,
				maxBatchingWindow: Duration.minutes(1),
				// A dropped batch is only missed until the next change, which rewrites the
				// whole CSV again.
				retryAttempts: 2,
			}),
		);

		attachPoliciesToLambda(directoryUpdateLambda, [
			productPricingDynamoDBReadPolicy,
			productPricingDynamoDBWritePolicy,
			productArticleDynamoDBReadPolicy,
			productArticleDynamoDBWritePolicy,
			metricPutPolicy,
		]);

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

		if (props.toolDomainName) {
			createTool(this, {
				domainName: props.toolDomainName,
				capiKeyParam,
				productPricingReadPolicy: productPricingDynamoDBReadPolicy,
				productPricingWritePolicy: productPricingDynamoDBWritePolicy,
				// PROD's tool always shows PROD's data. Elsewhere it can also show PROD's, and set
				// its prices by hand while a switch is on.
				prodData:
					stage === 'PROD'
						? undefined
						: {
								capiKeyParam: new GuParameter(this, 'prodCapiKey', {
									fromSSM: true,
									default: `/PROD/${this.stack}/${appName}/capi-key`,
								}),
								pricingTableName: `${appName}-pricing-PROD`,
								editPricesParameterName: `/${stage}/${this.stack}/${appName}/edit-prod-prices`,
							},
			});
		}
	}
}
