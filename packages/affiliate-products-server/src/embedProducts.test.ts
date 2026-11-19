import type { Product as StoredProduct } from '@common/models';
import { jest } from '@jest/globals';
import { embedProducts } from './embedProducts';

const amazonUrl = 'https://www.amazon.co.uk/dp/B0EXAMPLE15';
const johnLewisUrl = 'https://www.johnlewis.com/dyson-v15-detect/p-example';
const argosUrl = 'https://www.argos.co.uk/product/example-shark';

const pricingTable = (products: StoredProduct[]) =>
	jest.fn<(urls: string[]) => Promise<StoredProduct[]>>(() =>
		Promise.resolve(products),
	);

const draftUrls = { region: 'GB', urls: [amazonUrl, johnLewisUrl, argosUrl] };

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
			draftUrls,
			getProductsByUrl,
			noPreviewPrices,
		);

		expect(noPreviewPrices).not.toHaveBeenCalled();
		expect(getProductsByUrl).toHaveBeenCalledWith([
			amazonUrl,
			johnLewisUrl,
			argosUrl,
		]);
		expect(result).toEqual({
			ok: true,
			body: {
				prices: {
					[amazonUrl]: {
						price: 499,
						currency: 'GBP',
						updatedAt: 1,
						updatedBy: 'amazon',
					},
					[johnLewisUrl]: {},
					[argosUrl]: { notInDirectory: true },
				},
			},
		});
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
			draftUrls,
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
		const { prices } = result.body;
		expect(prices[amazonUrl]).toMatchObject({ price: 479 });
		expect(prices[amazonUrl]?.notInDirectory).toBeUndefined();
		expect(prices[johnLewisUrl]).toEqual({ notInDirectory: true });
		expect(prices[argosUrl]).toEqual({ notInDirectory: true });
	});

	it("previews in the request's region", async () => {
		const getPreviewPrices = jest.fn<
			(products: StoredProduct[]) => Promise<StoredProduct[]>
		>(() => Promise.resolve([]));

		await embedProducts(
			{ region: 'US', urls: [amazonUrl] },
			pricingTable([]),
			getPreviewPrices,
		);

		expect(getPreviewPrices).toHaveBeenCalledWith([
			{ productMerchantUrl: amazonUrl, region: 'US' },
		]);
	});

	it("doesn't read the pricing table for a draft with no products", async () => {
		const getProductsByUrl = pricingTable([]);

		const result = await embedProducts(
			{ region: 'GB', urls: [] },
			getProductsByUrl,
			noPreviewPrices,
		);

		expect(result).toEqual({ ok: true, body: { prices: {} } });
		expect(getProductsByUrl).not.toHaveBeenCalled();
	});

	it.each([
		['an unknown region', { region: 'FR', urls: [amazonUrl] }],
		['no URLs', { region: 'GB' }],
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
