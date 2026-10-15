import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuScheduledLambda } from '@guardian/cdk/lib/patterns/scheduled-lambda';
import { type CfnParameter, Duration } from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/aws-events';
import type { Policy } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import type { Topic } from 'aws-cdk-lib/aws-sns';

export function attachPoliciesToLambda(
	lambda: GuLambdaFunction | GuScheduledLambda,
	policies: Policy[],
): void {
	policies.forEach((policy) => lambda.role?.attachInlinePolicy(policy));
}

export function createLambdas(scope: GuStack, props: CreateLambdasProps) {
	return {
		priceUpdateLambda: createPriceUpdateLambda(scope, props),
		pricesCsvLambda: createPricesCsvLambda(scope, props),
		directoryUpdateLambda: createProductDirectoryUpdateLambda(scope, props),
	};
}

export interface CreateLambdasProps {
	appName: string;
	stage: string;
	snsTopic: Topic;
	alarmActionsEnabled: boolean;
	capiKeyParam: CfnParameter;
	bucketName: string;
}

export function createPriceUpdateLambda(
	scope: GuStack,
	{ appName, stage, snsTopic, alarmActionsEnabled }: CreateLambdasProps,
): GuScheduledLambda {
	return new GuScheduledLambda(scope, 'ProductPriceUpdateLambda', {
		app: 'product-price-update-lambda',
		fileName: 'product-price-update-lambda.zip',
		handler: 'index.eventHandler',
		timeout: Duration.seconds(300),
		runtime: Runtime.NODEJS_22_X,
		architecture: Architecture.ARM_64,
		// Used for defining cron job execution
		rules: [
			{
				// 	// UTC time
				schedule: Schedule.cron({ hour: '12', minute: '0' }),
				description: `${appName} price update lambda cron`,
				input: undefined,
			},
		],
		monitoringConfiguration: {
			toleratedErrorPercentage: 1, // alarm on essentially any error
			alarmName: `${appName}-product-price-update-lambda-${stage}-alarm`,
			alarmDescription: `Something went wrong updating the products in the ${appName} product-price-update-lambda ${stage}. Check the logs`,
			snsTopicName: snsTopic.topicName,
			actionsEnabled: alarmActionsEnabled,
		},
	});
}

/** Rewrites the prices CSV from the whole pricing table whenever the table changes. */
export function createPricesCsvLambda(
	scope: GuStack,
	{
		appName,
		stage,
		snsTopic,
		alarmActionsEnabled,
		bucketName,
	}: CreateLambdasProps,
): GuLambdaFunction {
	return new GuLambdaFunction(scope, 'ProductPricesCsvLambda', {
		app: 'product-prices-csv-lambda',
		fileName: 'product-prices-csv-lambda.zip',
		handler: 'index.eventHandler',
		environment: {
			BUCKET: bucketName,
		},
		timeout: Duration.seconds(60),
		// One rewrite at a time, so a rewrite from an older read of the table can't
		// finish after a newer one and overwrite it. csv-publisher.ts also relies on this
		// to skip batches an earlier rewrite already covered.
		reservedConcurrentExecutions: 1,
		runtime: Runtime.NODEJS_22_X,
		architecture: Architecture.ARM_64,
		errorPercentageMonitoring: {
			toleratedErrorPercentage: 1, // alarm on essentially any error
			alarmName: `${appName}-product-prices-csv-lambda-${stage}-alarm`,
			alarmDescription: `Something went wrong writing the prices CSV in the ${appName} product-prices-csv-lambda ${stage}. Check the logs`,
			snsTopicName: snsTopic.topicName,
			actionsEnabled: alarmActionsEnabled,
		},
	});
}

export function createProductDirectoryUpdateLambda(
	scope: GuStack,
	{
		appName,
		stage,
		snsTopic,
		alarmActionsEnabled,
		capiKeyParam,
	}: CreateLambdasProps,
): GuLambdaFunction {
	return new GuLambdaFunction(scope, 'ProductDirectoryUpdateLambda', {
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
	});
}
