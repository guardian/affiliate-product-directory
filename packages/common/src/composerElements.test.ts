import { composerContentFixture } from '@mocks/ComposerContentFixture';
import { composerElementsToBlocks } from './composerElements';
import { extractProducts } from './products';

const productsIn = (elements: unknown[]) =>
	extractProducts(composerElementsToBlocks(elements));

describe('composerElementsToBlocks', () => {
	it("finds the products in Composer's elements", () => {
		expect(productsIn(composerContentFixture.elements)).toEqual([
			{
				name: 'Dyson V15 Detect',
				links: [
					{
						url: 'https://www.amazon.co.uk/dp/B0EXAMPLE15',
						label: '£549 at Amazon',
						retailer: 'Amazon',
						basePrice: { currencySymbol: '£', amount: 549 },
					},
					{
						url: 'https://www.johnlewis.com/dyson-v15-detect/p-example',
						label: '£599 at John Lewis',
						retailer: 'John Lewis',
						basePrice: { currencySymbol: '£', amount: 599 },
					},
				],
			},
			{
				name: 'Shark Stratos',
				links: [
					{
						url: 'https://www.argos.co.uk/product/example-shark',
						label: '£199 at Argos',
						retailer: 'Argos',
						basePrice: { currencySymbol: '£', amount: 199 },
					},
				],
			},
		]);
	});

	it.each(['product-button', 'PRODUCT_BUTTON', 'ProductButton'])(
		'reads a link of type %s as a product button',
		(linkType) => {
			expect(
				productsIn([
					{
						elementType: 'link-element',
						fields: {
							linkType,
							url: 'https://example.com/a',
							label: '£5 at A',
						},
					},
				]),
			).toHaveLength(1);
		},
	);

	it('ignores links that are not product buttons', () => {
		expect(
			productsIn([
				{
					elementType: 'link-element',
					fields: { linkType: 'standard', url: 'https://example.com/a' },
				},
			]),
		).toEqual([]);
	});

	it('reads product card links written as JSON', () => {
		const [product] = productsIn([
			{
				elementType: 'product',
				fields: {
					productName: 'Kettle',
					productCtas: JSON.stringify([
						{ url: 'https://example.com/k', retailer: 'Shop', price: '£20' },
					]),
				},
			},
		]);
		expect(product?.links.map((link) => link.url)).toEqual([
			'https://example.com/k',
		]);
	});

	it('reads product buttons inside a product card', () => {
		const [product] = productsIn([
			{
				elementType: 'product',
				fields: {
					productName: 'Kettle',
					content: [
						{
							elementType: 'link-element',
							fields: {
								linkType: 'product-button',
								url: 'https://example.com/k',
								label: '£20 at Shop',
							},
						},
					],
				},
			},
		]);
		expect(product?.links.map((link) => link.label)).toEqual(['£20 at Shop']);
	});

	it("doesn't name product buttons after text from before an image", () => {
		const [product] = productsIn([
			{ elementType: 'text', fields: { text: '<h2>Best kettle: Kettle</h2>' } },
			{ elementType: 'image', fields: {} },
			{
				elementType: 'link-element',
				fields: {
					linkType: 'product-button',
					url: 'https://example.com/k',
					label: '£20 at Shop',
				},
			},
		]);
		expect(product?.name).toBeUndefined();
	});

	it.each([
		['not an object', 'text'],
		['null', null],
		['fields that are not an object', { elementType: 'text', fields: 'x' }],
	])('ignores an element that is %s', (_name, element) => {
		expect(composerElementsToBlocks([element])).toEqual([{ elements: [] }]);
	});

	it('ignores card links that are not objects', () => {
		expect(
			productsIn([
				{
					elementType: 'product',
					fields: { productName: 'Kettle', productCtas: ['x', 3] },
				},
			]),
		).toEqual([]);
	});
});
