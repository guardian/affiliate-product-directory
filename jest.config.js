/*
When running in CI (GitHub Actions), use the GitHub Actions reporter to annotate the PR with any test failures.
Locally, use the default reporter.

See:
  - https://jestjs.io/docs/configuration#github-actions-reporter
  - https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
 */
const reporters = process.env.GITHUB_ACTIONS
	? [['github-actions', { silent: false }], 'summary']
	: ['default'];

const esmTsTransform = [
	'ts-jest',
	{
		useESM: true,
	},
];

export default {
	reporters,
	verbose: true,
	testEnvironment: 'node',
	projects: [
		{
			displayName: 'cdk',
			transform: {
				'^.+\\.tsx?$': 'ts-jest',
			},
			setupFilesAfterEnv: ['<rootDir>/packages/cdk/jest.setup.js'],
			testMatch: ['<rootDir>/packages/cdk/**/*.test.ts'],
		},
		{
			displayName: 'lambda',
			extensionsToTreatAsEsm: ['.ts'],
			transform: {
				'^.+\\.tsx?$': esmTsTransform,
			},
			moduleNameMapper: {
				'^(\\.{1,2}/.*)\\.js$': '$1',
			},
			testMatch: [
				'<rootDir>/packages/*lambda/**/*.test.ts',
				'<rootDir>/packages/common/**/*.test.ts',
			],
		},
	],
};
