import { formatPrice } from './format';

describe('formatPrice', () => {
	it('formats decimal place to two places', () => {
		const price = 1.5;
		const result = formatPrice(price);
		expect(result).toEqual('1.50');
	});

	it('formats whole number to no decimal places', () => {
		const price = 15;
		const result = formatPrice(price);
		expect(result).toEqual('15');
	});
});
