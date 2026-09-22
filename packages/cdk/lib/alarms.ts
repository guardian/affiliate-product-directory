import { GuAlarm } from '@guardian/cdk/lib/constructs/cloudwatch';
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { Duration } from 'aws-cdk-lib';
import {
	ComparisonOperator,
	Metric,
	TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import type { Topic } from 'aws-cdk-lib/aws-sns';

export function createAlarms(
	scope: GuStack,
	{
		appName,
		stage,
		snsTopic,
		alarmActionsEnabled,
	}: {
		appName: string;
		stage: string;
		snsTopic: Topic;
		alarmActionsEnabled: boolean;
	},
) {
	const productsUpdatedMetric = new Metric({
		namespace: 'AffiliateProductDirectory',
		metricName: 'ArticleProductsUpdated',
		dimensionsMap: { Stage: stage },
		period: Duration.hours(24),
		statistic: 'Sum',
	});

	new GuAlarm(scope, 'NoArticleProductsUpdatedAlarm', {
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

	new GuAlarm(scope, 'NoSkimlinksProductsFetchedAlarm', {
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

	new GuAlarm(scope, 'NoAmazonProductsFetchedAlarm', {
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
