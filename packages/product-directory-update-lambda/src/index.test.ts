import { jest } from '@jest/globals';

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'frontend';
		process.env.STAGE = 'TEST';
		process.env.APP = 'product-price-update-lambda';
	});

	it('should return a greeting', async () => {
		jest.unstable_mockModule('./deserialize', () => ({
			deserializeEvent: jest.fn(),
			deserializeItemResponse: jest.fn(),
			deserialzeTagsResponse: jest.fn(),
		}));

		const { main } = await import('./index');
		const response = await main();
		expect(response).toContain(
			'Hello from product-price-update-lambda in TEST! The time is ',
		);
	});
});
