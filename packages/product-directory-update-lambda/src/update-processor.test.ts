import { getRemovedProducts } from './update-processor';

describe('getRemovedProducts', () => {
	it("returns the products currently stored that aren't in updated content", () => {
		const newProducts = ['example.com', 'amazon.com'];
		const oldProducts = ['example.com', 'argos.com'];

		const result = getRemovedProducts(newProducts, oldProducts);
		expect(result).toEqual(['argos.com']);
	});
});
