import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AffiliateProductDirectory } from './affiliate-product-directory';

describe('The AffiliateProductDirectoryLambda stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new AffiliateProductDirectory(
			app,
			'AffiliateProductDirectoryLambda',
			{
				stack: 'frontend',
				stage: 'TEST',
				env: {
					region: 'eu-west-1',
				},
				app: 'affiliate-product-directory',
			},
		);
		const template = Template.fromStack(stack);

		/**
		 * Snapshot testing helps to understand exactly what impact a CDK change will have on the provisioned infrastructure.
		 *
		 * @see https://github.com/guardian/cdk/blob/main/docs/best-practices.md#snapshot-testing
		 */
		expect(template.toJSON()).toMatchSnapshot();
	});
});
