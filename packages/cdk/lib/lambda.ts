import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuScheduledLambda } from '@guardian/cdk/lib/patterns/scheduled-lambda';
import type { CfnParameter } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import type { Topic } from 'aws-cdk-lib/aws-sns';

export function createLambdas(scope: GuStack, props: CreateLambdasProps) {
	return {
		priceUpdateLambda: createPriceUpdateLambda(scope, props),
		directoryUpdateLambda: createProductDirectoryUpdateLambda(scope, props),
	};
}

export interface CreateLambdasProps {
	appName: string;
	stage: string;
	snsTopic: Topic;
	alarmActionsEnabled: boolean;
	capiKeyParam: CfnParameter;
}

export function createPriceUpdateLambda(
	scope: GuStack,
	{ appName, stage, snsTopic, alarmActionsEnabled }: CreateLambdasProps,
): GuScheduledLambda {
	return new GuScheduledLambda(scope, 'ProductPriceUpdateLambda', {
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
