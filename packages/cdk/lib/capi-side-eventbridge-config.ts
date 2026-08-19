import { GuParameter, GuStack } from '@guardian/cdk/lib/constructs/core';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { aws_events_targets } from 'aws-cdk-lib';
import type { App } from 'aws-cdk-lib';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';

export class FrontendAccountEventbridgeConnection extends GuStack {
	constructor(scope: App, name: string, props: GuStackProps) {
		super(scope, name, props);

		//This needs to be manually configured by the related crier-eventbridge stack in Frontend account
		const targetEventBusParam = new GuParameter(this, 'FrontendEBParam', {
			fromSSM: true,
			default: `/${this.stage}/${this.stack}/${this.app}/frontend-eventbus-arn`,
		});

		const sourceEventBus = EventBus.fromEventBusName(
			this,
			'capiEB',
			`crier-eventbus-content-api-crier-v2-${this.stage}`,
		);
		const targetEventBus = EventBus.fromEventBusArn(
			this,
			'FrontendEB',
			targetEventBusParam.valueAsString,
		);
		new Rule(this, 'FrontendBusConnection', {
			eventBus: sourceEventBus,
			description: `Relay Crier events to the Frontend account event bus ${this.stage}`,
			eventPattern: { source: ['crier'] },
			targets: [
				new aws_events_targets.EventBus(targetEventBus), //this requires a Role to be created, but the docs say it'll be done automatically if we ignore...
			],
		});
	}
}
