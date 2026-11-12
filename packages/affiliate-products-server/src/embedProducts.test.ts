import type { Product as StoredProduct } from '@common/models';
import { jest } from '@jest/globals';
import { composerContentFixture } from '@mocks/ComposerContentFixture';
import { embedProducts } from './embedProducts';

const amazonUrl = 'https://www.amazon.co.uk/dp/B0EXAMPLE15';
const johnLewisUrl = 'https://www.johnlewis.com/dyson-v15-detect/p-example';
const argosUrl = 'https://www.argos.co.uk/product/example-shark';

const pricingTable = (products: StoredProduct[]) =>
	jest.fn<(urls: string[]) => Promise<StoredProduct[]>>(() =>
		Promise.resolve(products),
	);

const noPreviewPrices = jest.fn<
	(products: StoredProduct[]) => Promise<StoredProduct[]>
>(() => Promise.resolve([]));

describe('embedProducts', () => {
	it("attaches the directory's prices, and marks the links it doesn't have", async () => {
		const getProductsByUrl = pricingTable([
			{
				productMerchantUrl: amazonUrl,
				region: 'GB',
				price: 499,
				currency: 'GBP',
				updatedAt: 1,
				updatedBy: 'amazon',
			},
			// Known, but not priced yet.
			{ productMerchantUrl: johnLewisUrl, region: 'GB' },
			{ productMerchantUrl: argosUrl, region: 'GB', removed: 'true' },
		]);

		const result = await embedProducts(
			composerContentFixture,
			getProductsByUrl,
			noPreviewPrices,
		);

		expect(noPreviewPrices).not.toHaveBeenCalled();
		expect(getProductsByUrl).toHaveBeenCalledWith([
			amazonUrl,
			johnLewisUrl,
			argosUrl,
		]);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expect(result.body.region).toBe('GB');
		const links = result.body.products.flatMap((product) => product.links);
		expect(
			links.map(({ url, price, notInDirectory }) => ({
				url,
				price,
				notInDirectory,
			})),
		).toEqual([
			{ url: amazonUrl, price: 499, notInDirectory: undefined },
			{ url: johnLewisUrl, price: undefined, notInDirectory: undefined },
			{ url: argosUrl, price: undefined, notInDirectory: true },
		]);
	});

	it('previews and adds URLs missing from the directory', async () => {
		const getPreviewPrices = jest.fn<
			(products: StoredProduct[]) => Promise<StoredProduct[]>
		>((products) =>
			Promise.resolve([
				{
					...products[0]!,
					price: 479,
					currency: 'GBP',
					updatedAt: 2,
					updatedBy: 'amazon',
				},
			]),
		);

		const result = await embedProducts(
			composerContentFixture,
			pricingTable([]),
			getPreviewPrices,
		);

		expect(getPreviewPrices).toHaveBeenCalledWith([
			{ productMerchantUrl: amazonUrl, region: 'GB' },
			{ productMerchantUrl: johnLewisUrl, region: 'GB' },
			{ productMerchantUrl: argosUrl, region: 'GB' },
		]);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const links = result.body.products.flatMap((product) => product.links);
		expect(links[0]).toMatchObject({
			url: amazonUrl,
			price: 479,
		});
		expect(links[0]?.notInDirectory).toBeUndefined();
		expect(links.slice(1).every((link) => link.notInDirectory)).toBe(true);
	});

	it("prices thefilter-us's drafts in the US", async () => {
		const result = await embedProducts(
			{ ...composerContentFixture, section: 'thefilter-us' },
			pricingTable([]),
			noPreviewPrices,
		);

		expect(result.ok && result.body.region).toBe('US');
	});

	it("doesn't read the pricing table for a draft with no products", async () => {
		const getProductsByUrl = pricingTable([]);

		const result = await embedProducts(
			{ ...composerContentFixture, elements: [] },
			getProductsByUrl,
			noPreviewPrices,
		);

		expect(result).toEqual({ ok: true, body: { region: 'GB', products: [] } });
		expect(getProductsByUrl).not.toHaveBeenCalled();
	});

	it.each([
		['an unknown version', { ...composerContentFixture, version: 2 }],
		['no elements', { ...composerContentFixture, elements: undefined }],
		['nothing', undefined],
	])('rejects a request with %s', async (_name, request) => {
		const result = await embedProducts(
			request,
			pricingTable([]),
			noPreviewPrices,
		);

		expect(result.ok).toBe(false);
	});
});
