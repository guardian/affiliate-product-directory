import { getConfig } from './config';
import { appName } from './constants';

type MetricUnit = 'Count' | 'Milliseconds' | 'None';

/**
 * Emits a single custom metric to CloudWatch using the Embedded Metric Format
 * (EMF). The Lambda runtime ships stdout to CloudWatch Logs, which parses these
 * blobs into metrics under the `affiliate-product-directory` namespace.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 *
 * @param name - metric name, e.g. `SkimlinksDataRetrieved`
 * @param value - metric value (defaults to 1, i.e. "this happened once")
 * @param unit - CloudWatch unit (defaults to `Count`)
 * @param dimensions - extra dimensions to slice the metric by, merged on top of
 *   the default `stage` / `app` dimensions
 */
export function emitMetric(
	name: string,
	value = 1,
	unit: MetricUnit = 'Count',
	dimensions: Record<string, string> = {},
): void {
	const { stage, app } = getConfig();
	const allDimensions = { stage, app, ...dimensions };

	console.log(
		JSON.stringify({
			_aws: {
				Timestamp: Date.now(),
				CloudWatchMetrics: [
					{
						Namespace: appName,
						Dimensions: [Object.keys(allDimensions)],
						Metrics: [{ Name: name, Unit: unit }],
					},
				],
			},
			...allDimensions,
			[name]: value,
		}),
	);
}
