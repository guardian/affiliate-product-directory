import {
	CloudWatchClient,
	PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { getConfig } from '@common/config';

const cloudwatchClient = new CloudWatchClient({
	region: process.env['AWS_REGION'] ?? 'eu-west-1',
});

export type KnownMetric =
	| 'ArticleProductsUpdated'
	| 'SkimlinksProductsFetched'
	| 'AmazonProductsFetched';

export async function registerMetric(metricName: KnownMetric, value: number) {
	const { stack, stage } = getConfig();
	const req = new PutMetricDataCommand({
		Namespace: 'AffiliateProductDirectory',
		MetricData: [
			{
				MetricName: metricName,
				Dimensions: [
					{
						Name: 'Stack',
						Value: stack,
					},
					{
						Name: 'Stage',
						Value: stage,
					},
				],
				Timestamp: new Date(),
				Value: value,
			},
		],
	});

	const response = await cloudwatchClient.send(req);
	console.debug(
		`Updated ${metricName} metric after ${
			response.$metadata.attempts ?? 1
		} attempts`,
	);
}
