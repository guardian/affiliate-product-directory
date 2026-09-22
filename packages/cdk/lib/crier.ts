// constructs/crier-events.ts
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuParameter } from '@guardian/cdk/lib/constructs/core';
import type { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { Duration } from 'aws-cdk-lib';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { CrierEventbridge } from './crier-eventbridge';

export function createCrier(
	scope: GuStack,
	{
		appName,
		stage,
		directoryUpdateLambda,
	}: {
		appName: string;
		stage: string;
		directoryUpdateLambda: GuLambdaFunction;
	},
) {
	new CrierEventbridge(scope, 'Crier');

	const eventBusParam = new GuParameter(scope, 'EventBus', {
		fromSSM: true,
		default: `/${stage}/frontend/frontend-shared-infra/crier-event-bus`,
	});

	const crierEventBus = EventBus.fromEventBusName(
		scope,
		'CrierEventBus',
		eventBusParam.valueAsString,
	);

	const crierDlq = new Queue(scope, 'CrierConnectionDLQ', {
		queueName: `${appName}-crier-dlq-${stage}`,
	});

	new Rule(scope, 'CrierConnection', {
		eventBus: crierEventBus,
		description: `Connect product-directory-update-lambda ${stage} to Crier`,
		eventPattern: {
			source: ['crier'],
			detailType: [
				'content-update',
				'content-delete',
				'content-retrievableupdate',
			],
		},
		targets: [
			new aws_events_targets.LambdaFunction(directoryUpdateLambda, {
				deadLetterQueue: crierDlq,
				maxEventAge: Duration.minutes(30),
				retryAttempts: 3,
			}),
		],
	});

	new Rule(scope, 'BackfillConnection', {
		eventBus: crierEventBus,
		description: `Connect product-directory-update-lambda ${stage} to backfill events`,
		eventPattern: { source: ['backfill'] },
		targets: [new aws_events_targets.LambdaFunction(directoryUpdateLambda)],
	});

	return { crierEventBus, crierDlq };
}
