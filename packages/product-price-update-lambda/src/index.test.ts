import { main } from './index';

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'frontend';
		process.env.STAGE = 'TEST';
		process.env.APP = 'product-price-update-lambda';
	});

	it('should return a greeting', async () => {
		const response = await main();
		expect(response).toContain(
			'Hello from product-price-update-lambda in TEST! The time is ',
		);
	});
});
