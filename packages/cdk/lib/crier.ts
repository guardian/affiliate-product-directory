// constructs/crier-events.ts
import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuParameter } from '@guardian/cdk/lib/constructs/core';
import type { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { Duration } from 'aws-cdk-lib';
import type { IEventBus } from 'aws-cdk-lib/aws-events';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import * as aws_events_targets from 'aws-cdk-lib/aws-events-targets';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { CrierEventbridge } from './crier-eventbridge';

/**
 * Sets up the shared Crier event bus (Guardian's content-update feed) and a dead-letter queue
 * for failed lambda invocations, ready to be wired to a lambda via `connectDirectoryUpdateLambdaToCrier`.
 */
export function createCrier(
	scope: GuStack,
	{
		appName,
		stage,
	}: {
		appName: string;
		stage: string;
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

	return { crierEventBus, crierDlq };
}

/**
 * Connects the directory-update lambda to the Crier event bus: one rule for content
 * update/delete/retrievableupdate events, and one for backfill events. Failed invocations of the
 * content-update rule are sent to `deadLetterQueue` after 3 retries so they can be
 * inspected/replayed rather than silently lost.
 */
export function connectDirectoryUpdateLambdaToCrier(
	scope: Construct,
	{
		stage,
		lambda,
		eventBus,
		deadLetterQueue,
	}: {
		stage: string;
		lambda: GuLambdaFunction;
		eventBus: IEventBus;
		deadLetterQueue: Queue;
	},
): void {
	new Rule(scope, 'CrierConnection', {
		eventBus,
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
			new aws_events_targets.LambdaFunction(lambda, {
				deadLetterQueue,
				maxEventAge: Duration.minutes(30),
				retryAttempts: 3,
			}),
		],
	});

	new Rule(scope, 'BackfillConnection', {
		eventBus,
		description: `Connect product-directory-update-lambda ${stage} to backfill events`,
		eventPattern: { source: ['backfill'] },
		targets: [new aws_events_targets.LambdaFunction(lambda)],
	});
}
