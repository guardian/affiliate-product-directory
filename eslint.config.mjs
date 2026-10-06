import guardian from '@guardian/eslint-config';
import prettier from 'eslint-plugin-prettier';

export default [
	{
		ignores: ['**/build/**', '**/dist/**', '**/cdk.out/**'],
	},
	...guardian.configs.recommended,
	...guardian.configs.jest,
	...guardian.configs.react.map((config) => ({
		...config,
		files: ['packages/affiliate-products-client/**/*.{ts,tsx}'],
	})),
	{
		// Vite requires its config to be a default export
		files: ['**/vite.config.ts'],
		rules: {
			'import/no-default-export': 'off',
		},
	},
	{
		plugins: {
			prettier,
		},
		rules: {
			'prettier/prettier': 'error',
		},
	},
];
