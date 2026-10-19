import type { Product } from '@common/tool-models';
import { extractProducts } from './products';
import type { BlockElement, LinkElement } from './types';

const productButton = (url: string, label: string): LinkElement => ({
	type: 'link',
	linkTypeData: { url, label, linkType: 'product-button' },
});

const text: BlockElement = { type: 'text' };

const html = (body: string): BlockElement => ({
	type: 'text',
	textTypeData: { html: body },
});

const cta = (url: string, price: string, retailer: string, ctaText = '') => ({
	url,
	text: ctaText,
	retailer,
	price,
});

const productCard = (
	productTypeData: BlockElement['productTypeData'],
): BlockElement => ({ type: 'product', productTypeData });

/** Each product's name and its links' URLs, for tests that are only about grouping. */
const grouping = (products: Product[]) =>
	products.map(({ name, links }) => [name, links.map(({ url }) => url)]);

describe('extractProducts', () => {
	it('lists a run of product buttons as one product, at each of their retailers', () => {
		const products = extractProducts([
			{
				elements: [
					text,
					productButton('https://shop.example/a', '£27 at Shop'),
					productButton('https://other.example/a', '$1,200 at Other Shop'),
				],
			},
		]);

		expect(products).toEqual([
			{
				links: [
					{
						url: 'https://shop.example/a',
						label: '£27 at Shop',
						retailer: 'Shop',
						basePrice: { currencySymbol: '£', amount: 27 },
					},
					{
						url: 'https://other.example/a',
						label: '$1,200 at Other Shop',
						retailer: 'Other Shop',
						basePrice: { currencySymbol: '$', amount: 1200 },
					},
				],
			},
		]);
	});

	it('lists product buttons with anything but empty text between them as separate products', () => {
		const products = extractProducts([
			{
				elements: [
					productButton('https://shop.example/a', '£1 at Shop'),
					html(''),
					productButton('https://other.example/a', '£1 at Other Shop'),
					html('<p>Something else.</p>'),
					productButton('https://shop.example/b', '£2 at Shop'),
					{ type: 'image' },
					productButton('https://shop.example/c', '£3 at Shop'),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[undefined, ['https://shop.example/a', 'https://other.example/a']],
			[undefined, ['https://shop.example/b']],
			[undefined, ['https://shop.example/c']],
		]);
	});

	it('lists a product button without a price when its label has none', () => {
		const products = extractProducts([
			{
				elements: [
					productButton('https://shop.example/bread', '75p for 800g at Ocado'),
				],
			},
		]);

		expect(products).toEqual([
			{
				links: [
					{
						url: 'https://shop.example/bread',
						label: '75p for 800g at Ocado',
						retailer: 'Ocado',
					},
				],
			},
		]);
	});

	it("reads a product button's retailer from the end of its label", () => {
		const retailers = extractProducts([
			{
				elements: [
					productButton('https://shop.example/1', '£27 at Cult Beauty'),
					html('<p>Next.</p>'),
					productButton(
						'https://shop.example/2',
						'£2.20 for 580g at Morrisons (38p/100g)',
					),
					html('<p>Next.</p>'),
					productButton('https://shop.example/3', 'Explore the Filter'),
				],
			},
		]).map(({ links }) => links[0]?.retailer);

		expect(retailers).toEqual(['Cult Beauty', 'Morrisons', undefined]);
	});

	it('names a run of product buttons after the bold paragraph just before it', () => {
		const products = extractProducts([
			{
				elements: [
					html(
						'<p>Some gifts.</p><p><strong>Pasta</strong><strong> maker</strong></p>',
					),
					productButton('https://shop.example/pasta', '£30 at Shop'),
					productButton('https://other.example/pasta', '£32 at Other'),
					html('<p><strong>Tea &amp; biscuits</strong></p>'),
					productButton('https://shop.example/tea', '£5 at Shop'),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[
				'Pasta maker',
				['https://shop.example/pasta', 'https://other.example/pasta'],
			],
			['Tea & biscuits', ['https://shop.example/tea']],
		]);
	});

	it('names a run of product buttons after the heading just before it, without its label', () => {
		const products = extractProducts([
			{
				elements: [
					html(
						'<p>Review.</p><h2><em>An eco-friendly alternative: <br></em>Dr Bronner’s Magic Soap</h2>',
					),
					productButton('https://shop.example/soap', '$16.67 at iHerb'),
					productButton('https://amazon.example/soap', '$16.97 at Amazon'),
					html('<h2>***</h2>'),
					productButton('https://shop.example/other', '$1 at Shop'),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[
				'Dr Bronner’s Magic Soap',
				['https://shop.example/soap', 'https://amazon.example/soap'],
			],
			[undefined, ['https://shop.example/other']],
		]);
	});

	it('names a run of product buttons after the "at a glance" list item just before it', () => {
		const products = extractProducts([
			{
				elements: [
					html(
						'<ul><li><p><strong>Best for travel:<br></strong>Tide to Go Pen</p></li></ul>',
					),
					productButton('https://shop.example/tide', '$2.97 at Walmart'),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			['Tide to Go Pen', ['https://shop.example/tide']],
		]);
	});

	it('only names product buttons after text that ends with the name', () => {
		const products = extractProducts([
			{
				elements: [
					html('<p><strong>Kettle</strong></p><p>Why we like it.</p>'),
					productButton('https://shop.example/kettle', '£30 at Shop'),
					html('<p><strong>Why we love it</strong> Because.</p>'),
					productButton('https://shop.example/toaster', '£40 at Shop'),
				],
			},
		]);

		expect(products.map(({ name }) => name)).toEqual([undefined, undefined]);
	});

	it("lists a product card as one product, with each of its retailers' links once", () => {
		const products = extractProducts([
			{
				elements: [
					productCard({
						brandName: 'Nars ',
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

		expect(products).toEqual([
			{
				name: 'Nars Radiant creamy concealer',
				links: [
					{
						url: 'https://shop.example/nars',
						label: '£27 at Cult Beauty',
						retailer: 'Cult Beauty',
						basePrice: { currencySymbol: '£', amount: 27 },
					},
					{
						url: 'https://nars.example/nars',
						label: '£29.50 at Nars',
						retailer: 'Nars',
						basePrice: { currencySymbol: '£', amount: 29.5 },
					},
				],
			},
		]);
	});

	it('adds buttons inside a product card that are not among its links to the card', () => {
		const products = extractProducts([
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

		expect(grouping(products)).toEqual([
			[
				'Venta LW25',
				['https://amazon.example/lw25', 'https://abt.example/lw15'],
			],
		]);
	});

	it('combines products that share a URL where the first appears, preferring a card’s name', () => {
		const products = extractProducts([
			{
				elements: [
					// An "at a glance" list.
					html(
						'<ul><li><p><strong>Best overall:</strong><br>Zout</p></li></ul>',
					),
					productButton('https://dk.example/zout', '$5.54 at DK Hardware'),
					html(
						'<ul><li><p><strong>Best budget:</strong><br>Tide</p></li></ul>',
					),
					productButton('https://walmart.example/tide', '$2.97 at Walmart'),
					// The products in full, with more retailers.
					html('<h2>Zout No Scent Laundry Stain Remover</h2>'),
					productButton('https://dk.example/zout', '$5.54 at DK Hardware'),
					productButton('https://walmart.example/zout', '$15.48 at Walmart'),
					productCard({
						brandName: 'Tide',
						productName: 'To Go Instant Stain Remover Pen',
						productCtas: [
							cta('https://walmart.example/tide', '$2.97', 'Walmart'),
							cta('https://target.example/tide', '$2.99', 'Target'),
						],
					}),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			['Zout', ['https://dk.example/zout', 'https://walmart.example/zout']],
			[
				'Tide To Go Instant Stain Remover Pen',
				['https://walmart.example/tide', 'https://target.example/tide'],
			],
		]);
	});

	it('joins every earlier product that shares a URL with a later one into the first', () => {
		const products = extractProducts([
			{
				elements: [
					html('<p><strong>Zout at DK</strong></p>'),
					productButton('https://dk.example/zout', '$5.54 at DK Hardware'),
					html('<p><strong>Tide</strong></p>'),
					productButton('https://walmart.example/tide', '$2.97 at Walmart'),
					html('<p><strong>Zout at Walmart</strong></p>'),
					productButton('https://walmart.example/zout', '$15.48 at Walmart'),
					// Lists the second and third products' URLs before the first's.
					productCard({
						brandName: 'Zout',
						productName: 'No Scent Laundry Stain Remover',
						productCtas: [
							cta('https://walmart.example/zout', '$15.48', 'Walmart'),
							cta('https://dk.example/zout', '$5.54', 'DK Hardware'),
						],
					}),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[
				'Zout No Scent Laundry Stain Remover',
				['https://dk.example/zout', 'https://walmart.example/zout'],
			],
			['Tide', ['https://walmart.example/tide']],
		]);
	});

	it('leaves out links back to the Filter, and products left with none', () => {
		const products = extractProducts([
			{
				elements: [
					html('<h2>I tried 10 laundry baskets</h2>'),
					productButton(
						'https://www.theguardian.com/us/thefilter',
						'Explore the Filter',
					),
					html('<p>More.</p>'),
					productButton('https://www.theguardian.com/thefilter', 'The Filter'),
					productButton(
						'https://theguardian.com/thefilter-us/2026/jan/01/best-hampers',
						'Read our review',
					),
					productButton(
						'https://m.code.dev-theguardian.com/uk/thefilter',
						'The Filter UK',
					),
					productButton('https://shop.example/hamper', '$20 at Shop'),
					html('<p>Not the Filter.</p>'),
					productButton(
						'https://www.theguardian.com/thefilterama',
						'Somewhere else',
					),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[undefined, ['https://shop.example/hamper']],
			[undefined, ['https://www.theguardian.com/thefilterama']],
		]);
	});

	it('skips links that have no URL, and products left with none', () => {
		const products = extractProducts([
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

		expect(products).toEqual([]);
	});

	it("takes a product card link's price from its price field when its text has none", () => {
		const [product] = extractProducts([
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

		expect(product).toEqual({
			links: [
				{
					url: 'https://shop.example/a',
					label: 'Buy it here',
					retailer: 'Shop',
					basePrice: { currencySymbol: '£', amount: 45 },
				},
			],
		});
	});

	it('ignores links that are not product buttons', () => {
		const products = extractProducts([
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

		expect(products).toEqual([]);
	});

	it('keeps the order products appear in, across blocks', () => {
		const products = extractProducts([
			{ elements: [productButton('https://shop.example/1', '£1 at Shop')] },
			{},
			{
				elements: [
					productCard({
						productName: 'Thing',
						productCtas: [cta('https://shop.example/2', '£2', 'Shop')],
					}),
					productButton('https://shop.example/3', '£3 at Shop'),
				],
			},
		]);

		expect(grouping(products)).toEqual([
			[undefined, ['https://shop.example/1']],
			['Thing', ['https://shop.example/2']],
			[undefined, ['https://shop.example/3']],
		]);
	});

	it('returns nothing for an article with no body blocks', () => {
		expect(extractProducts([])).toEqual([]);
	});
});
