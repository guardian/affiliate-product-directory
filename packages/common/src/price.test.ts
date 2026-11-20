import { extractPriceFromLabel, getProductLinkLabelWithPrice } from './price';

describe('extractPriceFromLabel', () => {
	it.each([
		['£27 at Cult Beauty', '£', 27, '£27'],
		['£29.50 at Nars', '£', 29.5, '£29.50'],
		['$300 at Amazon', '$', 300, '$300'],
		['$1,200 at Abt Electronics', '$', 1200, '$1,200'],
		['$20 for 10 servings at Amazon', '$', 20, '$20'],
		['£2.20 for 580g at Morrisons (38p/100g)', '£', 2.2, '£2.20'],
		['From £15 at Boots', '£', 15, '£15'],
	])(
		'reads the price in "%s"',
		(label, currencySymbol, numericPrice, entireMatch) => {
			expect(extractPriceFromLabel(label)).toMatchObject({
				currencySymbol,
				numericPrice,
				entireMatch,
			});
		},
	);

	it('reads the first price when a label has two', () => {
		expect(extractPriceFromLabel('£10 at Shop, was £20')?.numericPrice).toBe(
			10,
		);
	});

	it.each([
		'75p for 800g at Ocado (10p/100g)',
		'Explore the Filter',
		'€40 at Zalando',
		'',
	])('finds no £ or $ price in "%s"', (label) => {
		expect(extractPriceFromLabel(label)).toBeUndefined();
	});
});

describe('getProductLinkLabelWithPrice', () => {
	const cta = {
		url: 'https://www.cultbeauty.co.uk/p/a-concealer',
		text: '',
		retailer: 'Cult Beauty',
		price: '£27',
	};

	it('combines the price and the retailer', () => {
		expect(getProductLinkLabelWithPrice(cta)).toBe('£27 at Cult Beauty');
	});

	it('uses the text instead when one has been written', () => {
		expect(
			getProductLinkLabelWithPrice({ ...cta, text: 'Buy the concealer' }),
		).toBe('Buy the concealer');
	});

	it('ignores text that is only spaces', () => {
		expect(getProductLinkLabelWithPrice({ ...cta, text: '  ' })).toBe(
			'£27 at Cult Beauty',
		);
	});
});
