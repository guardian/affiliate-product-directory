import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import type { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb';
import {
	GuAllowPolicy,
	GuDynamoDBReadPolicy,
	GuDynamoDBWritePolicy,
	GuPutS3ObjectsPolicy,
} from '@guardian/cdk/lib/constructs/iam';
import type { GuS3Bucket } from '@guardian/cdk/lib/constructs/s3';

export function createPolicies(
	scope: GuStack,
	{
		stage,
		appName,
		productPricingTable,
		productArticleTable,
		bucket,
		region,
		account,
	}: {
		stage: string;
		appName: string;
		productPricingTable: GuDynamoTable;
		productArticleTable: GuDynamoTable;
		bucket: GuS3Bucket;
		region: string;
		account: string;
	},
) {
	const productPricingDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
		scope,
		'ProductPricingDynamoReadPolicy',
		{ tableName: productPricingTable.tableName },
	);

	const productPricingDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
		scope,
		'ProductPricingDynamoWritePolicy',
		{ tableName: productPricingTable.tableName },
	);

	const productArticleDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
		scope,
		'ProductArticleDynamoReadPolicy',
		{ tableName: productArticleTable.tableName },
	);

	const productArticleDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
		scope,
		'ProductArticleDynamoWritePolicy',
		{ tableName: productArticleTable.tableName },
	);

	const parameterStoreReadPolicy = new GuAllowPolicy(
		scope,
		'ProductDirectoryParameterStoreReadPolicy',
		{
			actions: [
				'ssm:GetParameter',
				'ssm:GetParameters',
				'ssm:GetParametersByPath',
			],
			resources: [
				`arn:aws:ssm:${region}:${account}:parameter/${stage}/frontend/${appName}/*`,
			],
		},
	);

	const s3PutPolicy = new GuPutS3ObjectsPolicy(
		scope,
		'PutS3ProductDirectoryBucketObjectsPolicy',
		{
			bucketName: bucket.bucketName,
		},
	);

	const metricPutPolicy = new GuAllowPolicy(scope, 'putMetric', {
		resources: ['*'],
		actions: ['cloudwatch:PutMetricData'],
	});

	return {
		productPricingDynamoDBReadPolicy,
		productPricingDynamoDBWritePolicy,
		productArticleDynamoDBReadPolicy,
		productArticleDynamoDBWritePolicy,
		parameterStoreReadPolicy,
		s3PutPolicy,
		metricPutPolicy,
	};
}
