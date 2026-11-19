import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AffiliateProductDirectory } from './affiliate-product-directory';

const createTemplate = (stage: string) => {
	const app = new App();
	const stack = new AffiliateProductDirectory(
		app,
		'AffiliateProductDirectoryLambda',
		{
			stack: 'frontend',
			stage,
			env: {
				region: 'eu-west-1',
			},
			app: 'affiliate-product-directory',
			toolDomainName: `affiliate-products.${stage.toLowerCase()}.dev-gutools.co.uk`,
		},
	);
	return Template.fromStack(stack);
};

describe('The AffiliateProductDirectoryLambda stack', () => {
	it('matches the snapshot', () => {
		const template = createTemplate('TEST');

		/**
		 * Snapshot testing helps to understand exactly what impact a CDK change will have on the provisioned infrastructure.
		 *
		 * @see https://github.com/guardian/cdk/blob/main/docs/best-practices.md#snapshot-testing
		 */
		expect(template.toJSON()).toMatchSnapshot();
	});
});
