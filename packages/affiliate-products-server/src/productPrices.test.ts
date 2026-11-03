import type { Product } from '@common/models';
import { ArticlesPageSchema } from '@common/tool-models';
import type { ArticlesPage } from '@common/tool-models';
import { jest } from '@jest/globals';
import {
	attachProductPrices,
	createProductPrices,
	productUrls,
} from './productPrices';
import type { ProductPrices } from './types';

const pricedItem: Product = {
	productMerchantUrl: 'https://shop.example/a',
	region: 'GB',
	createdAt: 1750000000000,
	currency: 'GBP',
	price: 24.5,
	updatedAt: 1760000000000,
	updatedBy: 'skimlinks',
};

describe('createProductPrices', () => {
	const getProductsByUrl = jest.fn<(urls: string[]) => Promise<Product[]>>();

	beforeEach(() => {
		getProductsByUrl.mockReset();
		getProductsByUrl.mockResolvedValue([pricedItem]);
	});

	it('looks up the given URLs in the pricing table on every call', async () => {
		const getProductPrices = createProductPrices(getProductsByUrl);

		await getProductPrices(['https://shop.example/a']);
		await getProductPrices([
			'https://shop.example/a',
			'https://shop.example/b',
		]);

		expect(getProductsByUrl.mock.calls).toEqual([
			[['https://shop.example/a']],
			[['https://shop.example/a', 'https://shop.example/b']],
		]);
	});

	it("returns each product's price by its URL, without the item's other fields", async () => {
		const prices = await createProductPrices(getProductsByUrl)([
			'https://shop.example/a',
		]);

		expect([...prices]).toEqual([
			[
				'https://shop.example/a',
				{
					currency: 'GBP',
					price: 24.5,
					updatedAt: 1760000000000,
					updatedBy: 'skimlinks',
				},
			],
		]);
	});

	it('leaves out products that have been removed or not priced yet', async () => {
		const removed: Product = {
			...pricedItem,
			productMerchantUrl: 'https://shop.example/b',
			removed: 'true',
		};
		// As the directory adds a product, before any provider has priced it.
		const unpriced: Product = {
			productMerchantUrl: 'https://shop.example/c',
			region: 'US',
			createdAt: 1750000000000,
			updatedAt: 1750000000000,
			updatedBy: 'test',
		};
		getProductsByUrl.mockResolvedValue([pricedItem, removed, unpriced]);

		const prices = await createProductPrices(getProductsByUrl)([
			'https://shop.example/a',
			'https://shop.example/b',
			'https://shop.example/c',
		]);

		expect([...prices.keys()]).toEqual(['https://shop.example/a']);
	});

	it('fails when the pricing table cannot be read', async () => {
		getProductsByUrl.mockRejectedValue(new Error('DynamoDB is unavailable'));

		await expect(
			createProductPrices(getProductsByUrl)(['https://shop.example/a']),
		).rejects.toThrow('DynamoDB is unavailable');
	});
});

describe('productUrls', () => {
	const article = (id: string, urls: string[]) => ({
		id,
		sectionId: 'thefilter',
		status: 'live' as const,
		webPublicationDate: '2026-10-06T09:00:00Z',
		webTitle: id,
		webUrl: `https://www.theguardian.com/${id}`,
		livePricing: false,
		ophanUrl: `https://dashboard.ophan.co.uk/info?capi-id=${id}`,
		products: urls.map((url) => ({ links: [{ url, label: 'Buy at Shop' }] })),
	});

	it("lists every product's URL on the page once", () => {
		const page: ArticlesPage = {
			articles: [
				article('one', ['https://shop.example/a', 'https://shop.example/b']),
				article('two', ['https://shop.example/b', 'https://shop.example/c']),
				article('three', []),
			],
			currentPage: 1,
			pages: 1,
			total: 3,
		};

		expect(productUrls(page)).toEqual([
			'https://shop.example/a',
			'https://shop.example/b',
			'https://shop.example/c',
		]);
	});

	it("includes the drafts' product URLs", () => {
		const page: ArticlesPage = {
			drafts: [article('draft', ['https://shop.example/d'])],
			articles: [article('one', ['https://shop.example/a'])],
			currentPage: 1,
			pages: 1,
			total: 1,
		};

		expect(productUrls(page)).toEqual([
			'https://shop.example/d',
			'https://shop.example/a',
		]);
	});
});

describe('attachProductPrices', () => {
	const page: ArticlesPage = {
		articles: [
			{
				id: 'thefilter/2026/oct/06/an-article',
				sectionId: 'thefilter',
				status: 'live',
				webPublicationDate: '2026-10-06T09:00:00Z',
				webTitle: 'An article',
				webUrl: 'https://www.theguardian.com/thefilter/2026/oct/06/an-article',
				livePricing: false,
				ophanUrl:
					'https://dashboard.ophan.co.uk/info?capi-id=thefilter%2F2026%2Foct%2F06%2Fan-article',
				products: [
					{
						name: 'A product',
						links: [
							{
								url: 'https://shop.example/a',
								label: '£27 at Shop',
								retailer: 'Shop',
								basePrice: { currencySymbol: '£', amount: 27 },
							},
							{ url: 'https://shop.example/b', label: 'Buy at Shop' },
						],
					},
					{ links: [{ url: 'https://shop.example/c', label: '$5 at Shop' }] },
				],
			},
		],
		currentPage: 1,
		pages: 3,
		total: 60,
	};

	const prices: ProductPrices = new Map([
		[
			'https://shop.example/a',
			{
				currency: 'GBP',
				price: 24.5,
				updatedAt: 1760000000000,
				updatedBy: 'skimlinks',
			},
		],
	]);

	it("adds the directory's price to the products it has priced", () => {
		const { articles } = attachProductPrices(page, prices);

		expect(articles[0]?.products).toEqual([
			{
				name: 'A product',
				links: [
					{
						url: 'https://shop.example/a',
						label: '£27 at Shop',
						retailer: 'Shop',
						basePrice: { currencySymbol: '£', amount: 27 },
						currency: 'GBP',
						price: 24.5,
						updatedAt: 1760000000000,
						updatedBy: 'skimlinks',
					},
					{ url: 'https://shop.example/b', label: 'Buy at Shop' },
				],
			},
			{ links: [{ url: 'https://shop.example/c', label: '$5 at Shop' }] },
		]);
	});

	it('leaves the rest of the page as it was', () => {
		const { articles, ...paging } = attachProductPrices(page, prices);

		expect(paging).toEqual({ currentPage: 1, pages: 3, total: 60 });
		expect({ ...articles[0], products: [] }).toEqual({
			...page.articles[0],
			products: [],
		});
	});

	it('returns a page the client accepts', () => {
		// As the client receives it, once sent as JSON.
		const sent: unknown = JSON.parse(
			JSON.stringify(attachProductPrices(page, prices)),
		);

		expect(ArticlesPageSchema.parse(sent)).toEqual(sent);
	});
});
