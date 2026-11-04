import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import type { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
	BlockPublicAccess,
	Bucket,
	BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import {
	Effect,
	PolicyStatement,
	Role,
	ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { CfnOutput } from 'aws-cdk-lib';

interface ChangeCapturePipelineProps {
	tables: Array<{
		name: string;
		table: GuDynamoTable;
	}>;
	appName: string;
}

export function createChangeCapturePipeline(
	scope: GuStack,
	{ tables, appName }: ChangeCapturePipelineProps,
) {
	// S3 bucket for change logs
	const changeLogBucket = new Bucket(scope, 'ChangeLogBucket', {
		bucketName: `${appName}-change-log-${scope.stage.toLowerCase()}`,
		encryption: BucketEncryption.S3_MANAGED,
		blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
		enforceSSL: true,
		versioning: false,
		removalPolicy: RemovalPolicy.RETAIN,
	});

	// SQS Dead Letter Queue for failed records
	const dlq = new Queue(scope, 'ChangeLogDLQ', {
		queueName: `${appName}-change-log-dlq-${scope.stage.toLowerCase()}`,
		retentionPeriod: Duration.days(14),
		removalPolicy: RemovalPolicy.RETAIN,
	});

	// Lambda function to process DynamoDB stream records
	const changeCaptureLambda = new GuLambdaFunction(
		scope,
		'ChangeCaptureLambda',
		{
			app: 'change-capture-lambda',
			fileName: 'change-capture-lambda.zip',
			handler: 'index.handler',
			runtime: Runtime.NODEJS_22_X,
			architecture: Architecture.ARM_64,
			timeout: Duration.seconds(60),
			memorySize: 512,
			environment: {
				BUCKET_NAME: changeLogBucket.bucketName,
			},
			deadLetterQueue: dlq,
		},
	);

	// Grant Lambda S3 write permission
	changeLogBucket.grantWrite(changeCaptureLambda, 'changes/*');

	// Add DynamoDB stream event sources for each table
	tables.forEach(({ name, table }) => {
		changeCaptureLambda.addEventSource(
			new DynamoEventSource(table, {
				startingPosition: StartingPosition.TRIM_HORIZON,
				batchSize: 10,
				bisectBatchOnError: true,
				retryAttempts: 5,
			}),
		);
	});

	// Outputs
	new CfnOutput(scope, 'ChangeLogBucketName', {
		value: changeLogBucket.bucketName,
		description: 'S3 bucket for DynamoDB change logs',
	});

	new CfnOutput(scope, 'ChangeLogDLQUrl', {
		value: dlq.queueUrl,
		description: 'SQS queue for failed change records',
	});

	return { changeLogBucket, dlq, changeCaptureLambda };
}
