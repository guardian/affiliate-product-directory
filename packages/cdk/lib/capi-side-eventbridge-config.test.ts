import { describe, expect, it } from '@jest/globals';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FrontendAccountEventbridgeConnection } from './capi-side-eventbridge-config';

describe('The FrontendAccountEventbridgeConnection stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new FrontendAccountEventbridgeConnection(
			app,
			'FrontendAccountEventbridgeConnection-euwest-1-TEST',
			{ stack: 'content-api', stage: 'TEST', app: '' },
			'arn:aws:events:eu-west-1:123:event-bus/publication-events-TEST',
		);
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
