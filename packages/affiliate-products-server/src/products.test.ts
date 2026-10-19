import { extractProductLinks } from './products';
import type { BlockElement, LinkElement } from './types';

const productButton = (url: string, label: string): LinkElement => ({
	type: 'link',
	linkTypeData: { url, label, linkType: 'product-button' },
});

const text: BlockElement = { type: 'text' };

const cta = (url: string, price: string, retailer: string, ctaText = '') => ({
	url,
	text: ctaText,
	retailer,
	price,
});

const productCard = (
	productTypeData: BlockElement['productTypeData'],
): BlockElement => ({ type: 'product', productTypeData });

describe('extractProductLinks', () => {
	it('lists product buttons with the price from their label', () => {
		const links = extractProductLinks([
			{
				elements: [
					text,
					productButton('https://shop.example/a', '£27 at Shop'),
					productButton('https://shop.example/b', '$1,200 at Shop'),
				],
			},
		]);

		expect(links).toEqual([
			{
				url: 'https://shop.example/a',
				label: '£27 at Shop',
				basePrice: { currencySymbol: '£', amount: 27 },
			},
			{
				url: 'https://shop.example/b',
				label: '$1,200 at Shop',
				basePrice: { currencySymbol: '$', amount: 1200 },
			},
		]);
	});

	it('lists a product button without a price when its label has none', () => {
		const links = extractProductLinks([
			{
				elements: [
					productButton('https://shop.example/bread', '75p for 800g at Ocado'),
					productButton('https://www.theguardian.com/thefilter', 'Explore'),
				],
			},
		]);

		expect(links).toEqual([
			{ url: 'https://shop.example/bread', label: '75p for 800g at Ocado' },
			{ url: 'https://www.theguardian.com/thefilter', label: 'Explore' },
		]);
	});

	it("lists a product card's links once, with its product name", () => {
		const links = extractProductLinks([
			{
				elements: [
					productCard({
						brandName: 'Nars',
						productName: 'Radiant creamy concealer',
						productCtas: [
							cta('https://shop.example/nars', '£27', 'Cult Beauty'),
							cta('https://nars.example/nars', '£29.50', 'Nars'),
						],
						// The card's links again, as the buttons shown inside it.
						content: [
							text,
							productButton('https://shop.example/nars', '£27 at Cult Beauty'),
							productButton('https://nars.example/nars', '£29.50 at Nars'),
						],
					}),
				],
			},
		]);

		expect(links).toEqual([
			{
				url: 'https://shop.example/nars',
				label: '£27 at Cult Beauty',
				productName: 'Nars Radiant creamy concealer',
				basePrice: { currencySymbol: '£', amount: 27 },
			},
			{
				url: 'https://nars.example/nars',
				label: '£29.50 at Nars',
				productName: 'Nars Radiant creamy concealer',
				basePrice: { currencySymbol: '£', amount: 29.5 },
			},
		]);
	});

	it('lists buttons inside a product card that are not among its links', () => {
		const links = extractProductLinks([
			{
				elements: [
					productCard({
						productName: 'LW25',
						brandName: 'Venta',
						productCtas: [cta('https://amazon.example/lw25', '$300', 'Amazon')],
						content: [
							productButton(
								'https://abt.example/lw15',
								'$280 at Abt Electronics',
							),
						],
					}),
				],
			},
		]);

		expect(links.map(({ url, productName }) => [url, productName])).toEqual([
			['https://amazon.example/lw25', 'Venta LW25'],
			['https://abt.example/lw15', 'Venta LW25'],
		]);
	});

	it('skips links that have no URL', () => {
		const links = extractProductLinks([
			{
				elements: [
					productCard({
						productName: '',
						brandName: '',
						productCtas: [cta('', '', ''), cta('  ', '', '')],
					}),
					productButton('', '£10 at Shop'),
				],
			},
		]);

		expect(links).toEqual([]);
	});

	it("takes a product card link's price from its price field when its text has none", () => {
		const [link] = extractProductLinks([
			{
				elements: [
					productCard({
						productCtas: [
							cta('https://shop.example/a', '£45', 'Shop', 'Buy it here'),
						],
					}),
				],
			},
		]);

		expect(link).toEqual({
			url: 'https://shop.example/a',
			label: 'Buy it here',
			basePrice: { currencySymbol: '£', amount: 45 },
		});
	});

	it('ignores links that are not product buttons', () => {
		const links = extractProductLinks([
			{
				elements: [
					{
						type: 'link',
						linkTypeData: {
							url: 'https://example.com/read-more',
							label: '£5 off everything',
							linkType: 'standard-button',
						},
					},
					{ type: 'link' },
					{ type: 'product' },
				],
			},
		]);

		expect(links).toEqual([]);
	});

	it('keeps the order links appear in, across blocks, listing each URL once', () => {
		const links = extractProductLinks([
			{
				elements: [
					productButton('https://shop.example/1', '£1 at Shop'),
					productCard({
						productName: 'Thing',
						productCtas: [cta('https://shop.example/2', '£2', 'Shop')],
					}),
				],
			},
			{},
			{
				elements: [
					productButton('https://shop.example/3', '£3 at Shop'),
					productButton('https://shop.example/1', '£1 at Shop again'),
				],
			},
		]);

		expect(links.map(({ url }) => url)).toEqual([
			'https://shop.example/1',
			'https://shop.example/2',
			'https://shop.example/3',
		]);
		expect(links[0]?.label).toBe('£1 at Shop');
	});

	it('returns nothing for an article with no body blocks', () => {
		expect(extractProductLinks([])).toEqual([]);
	});
});
