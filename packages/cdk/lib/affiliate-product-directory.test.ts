import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
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

interface Statement {
	Effect: string;
	Action?: string | string[];
	NotAction?: string | string[];
	Resource: unknown;
}

const prodPricingTable = 'table/affiliate-product-directory-pricing-PROD';

/** Every IAM policy statement in the template that names PROD's pricing table. */
const prodPricingTableStatements = (template: Template): Statement[] =>
	Object.values(template.findResources('AWS::IAM::Policy'))
		.flatMap(
			(policy) =>
				(
					policy as {
						Properties: { PolicyDocument: { Statement: Statement[] } };
					}
				).Properties.PolicyDocument.Statement,
		)
		.filter((statement) =>
			JSON.stringify(statement.Resource).includes(prodPricingTable),
		);

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

	describe("outside PROD, the tool's access to PROD's data", () => {
		const template = createTemplate('TEST');

		it("only allows reading PROD's pricing table", () => {
			const allows = prodPricingTableStatements(template).filter(
				({ Effect }) => Effect === 'Allow',
			);

			expect(allows).toHaveLength(1);
			expect(allows[0]?.Action).toBe('dynamodb:BatchGetItem');
		});

		it("explicitly denies anything else on PROD's pricing table", () => {
			const denies = prodPricingTableStatements(template).filter(
				({ Effect }) => Effect === 'Deny',
			);

			expect(denies).toHaveLength(1);
			expect(denies[0]?.NotAction).toBe('dynamodb:BatchGetItem');
			expect(denies[0]?.Action).toBeUndefined();
			const resources = JSON.stringify(denies[0]?.Resource);
			expect(resources).toContain(`${prodPricingTable}"`);
			expect(resources).toContain(`${prodPricingTable}/*"`);
		});

		it("gives the tool PROD's CAPI key", () => {
			template.hasParameter('prodCapiKey', {
				Default: '/PROD/frontend/affiliate-product-directory/capi-key',
			});
			template.hasResourceProperties('AWS::Lambda::Function', {
				Environment: {
					Variables: Match.objectLike({
						PROD_CAPI_KEY: { Ref: 'prodCapiKey' },
					}),
				},
			});
		});
	});

	describe("in PROD, the tool's own data is already PROD's", () => {
		const template = createTemplate('PROD');

		it('is given no other CAPI key', () => {
			expect(template.findParameters('prodCapiKey')).toEqual({});
			template.resourcePropertiesCountIs(
				'AWS::Lambda::Function',
				{
					Environment: {
						Variables: Match.objectLike({ PROD_CAPI_KEY: Match.anyValue() }),
					},
				},
				0,
			);
		});

		it('has no explicit deny on its pricing table', () => {
			template.resourcePropertiesCountIs(
				'AWS::IAM::Policy',
				{
					PolicyDocument: {
						Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny' })]),
					},
				},
				0,
			);
		});
	});
});
