import { main } from './index';

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'frontend';
		process.env.STAGE = 'CODE';
		process.env.APP = 'affiliate-product-directory-lambda';
	});

	it('should return a greeting', async () => {
		const response = await main();
		expect(response).toContain(
			'Hello from affiliate-product-directory-lambda in CODE! The time is ',
		);
	});
});
