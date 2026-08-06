import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuParameter } from '@guardian/cdk/lib/constructs/core';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { AccountPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class CrierEventbridge extends Construct {
	constructor(scope: GuStack, name: string) {
		super(scope, name);

		const capiAccountNumber = new GuParameter(scope, 'CapiAcctParam', {
			fromSSM: true,
			type: 'String',
			default: `/${scope.stage}/${scope.stack}/${scope.app}/capiAccountNumber`,
		});

		const encryptionKey = new Key(this, 'EncKey');

		const bus = new EventBus(this, 'Events', {
			kmsKey: encryptionKey,
			eventBusName: `publication-events-${scope.stage}`,
			description: `Picks up events from Content API (crier) LIVE ${scope.stage} and makes them available to Frontend`,
		});

		bus.addToResourcePolicy(
			new PolicyStatement({
				sid: `CdkBasedAccountAllow${scope.stage}`,
				effect: Effect.ALLOW,
				principals: [new AccountPrincipal(capiAccountNumber.valueAsString)],
				actions: ['events:PutEvents'],
				resources: [bus.eventBusArn],
			}),
		);

		new StringParameter(this, 'OutputBusName', {
			parameterName: `/${scope.stage}/frontend/frontend-shared-infra/crier-event-bus`,
			stringValue: bus.eventBusName,
		});
	}
}
