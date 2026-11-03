import {
	productButtonLabel,
	shouldPutOldPriceInStrikethrough,
} from './productButtonLabel';

describe('shouldPutOldPriceInStrikethrough', () => {
	it.each([
		// At least 10% and at least 5 lower.
		[89, 105, true],
		[45, 50, true],
		// 10% lower, but less than 5.
		[18, 20, false],
		// 5 lower, but less than 10%.
		[95, 100, false],
		// Higher, or the same.
		[120, 100, false],
		[100, 100, false],
	])('is %p for %p down from %p', (latest, article, expected) => {
		expect(shouldPutOldPriceInStrikethrough(latest, article)).toBe(expected);
	});
});

describe('productButtonLabel', () => {
	it('strikes the article price through when the latest is much lower', () => {
		expect(
			productButtonLabel('£105 at Argos', { currency: 'GBP', price: 89 }),
		).toEqual({ struckThrough: '£105', text: ' £89 at Argos' });
	});

	it('replaces the article price when the latest is a little lower', () => {
		expect(
			productButtonLabel('$100 at Target', { currency: 'USD', price: 95.5 }),
		).toEqual({ text: '$95.50 at Target' });
	});

	it('replaces the article price when the latest is higher', () => {
		expect(
			productButtonLabel('£1,500 at Article', { currency: 'GBP', price: 1600 }),
		).toEqual({ text: '£1,600 at Article' });
	});

	it.each([
		['there is no latest price', '£105 at Argos', {}],
		[
			'the latest price is in another currency',
			'£105 at Argos',
			{ currency: 'USD', price: 50 },
		],
		[
			'the label is not "{price} at {retailer}"',
			'Buy now from Argos for £105',
			{ currency: 'GBP', price: 50 },
		],
		['the label has no price', 'Buy at Argos', { currency: 'GBP', price: 50 }],
	])('leaves the label as it is when %s', (_case, label, latest) => {
		expect(productButtonLabel(label, latest)).toEqual({ text: label });
	});
});
