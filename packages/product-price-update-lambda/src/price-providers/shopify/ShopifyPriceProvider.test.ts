import { jest } from '@jest/globals';
import { mockRegisterMetric } from '@mocks/CloudwatchMock';
import '@mocks/ConfigMock';
import { mockGetParametersFromParameterStore } from '@mocks/ParameterStoreMock';
import { buildProduct } from '@mocks/ProductFixtures';
import type * as ShopifyPriceProviderModule from './ShopifyPriceProvider';

let ShopifyPriceProvider: typeof ShopifyPriceProviderModule.ShopifyPriceProvider;

beforeAll(async () => {
	({ ShopifyPriceProvider } = await import('./ShopifyPriceProvider'));
});

let mockFetch: jest.SpiedFunction<typeof fetch>;

/** A Shopify `.json` product body with one variant per price. */
function shopifyProduct(prices: string[], currency = 'GBP') {
	return {
		product: {
			id: 1,
			handle: 'thing',
			variants: prices.map((price, i) => ({
				id: i,
				price,
				price_currency: currency,
			})),
		},
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

function requestedUrl(callIndex = 0): string {
	return (mockFetch.mock.calls[callIndex]![0] as URL).href;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockGetParametersFromParameterStore.mockResolvedValue({
		'/TEST/test-stack/affiliate-product-directory/shopify/enabled': 'true',
	});
	jest.spyOn(console, 'log').mockImplementation(() => {});
	mockRegisterMetric.mockResolvedValue();
	mockFetch = jest.spyOn(globalThis, 'fetch');
});

afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

function provider() {
	return new ShopifyPriceProvider();
}

describe('refreshPrices', () => {
	it('returns products updated with the first variant price', async () => {
		const staleUpdatedAt = Date.now() - 60_000;
		const product = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/thing',
			price: 10,
			currency: 'GBP',
			updatedAt: staleUpdatedAt,
		});
		mockFetch.mockResolvedValue(
			jsonResponse(shopifyProduct(['24.50', '30.00'], 'USD')),
		);

		const {
			updated: [updated],
		} = await provider().refreshPrices([product]);

		expect(updated).toMatchObject({
			productMerchantUrl: 'https://shop.example.com/products/thing',
			price: 24.5,
			currency: 'USD',
			updatedBy: 'shopify',
		});
		expect(updated!.updatedAt).toBeGreaterThan(staleUpdatedAt);
		expect(mockRegisterMetric).toHaveBeenCalledWith(
			'ShopifyProductsFetched',
			1,
		);
	});

	it('skips links that 404 without retrying', async () => {
		const product = buildProduct({
			productMerchantUrl: 'https://not-shopify.example.com/p/1',
		});
		mockFetch.mockResolvedValue(jsonResponse({}, 404));

		await expect(provider().refreshPrices([product])).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('skips links that do not return Shopify product json', async () => {
		const product = buildProduct({
			productMerchantUrl: 'https://not-shopify.example.com/p/1',
		});
		mockFetch.mockResolvedValue(jsonResponse({ something: 'else' }));

		await expect(provider().refreshPrices([product])).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
	});

	it('skips links that return a non-json body without retrying', async () => {
		const product = buildProduct({
			productMerchantUrl: 'https://not-shopify.example.com/p/1',
		});
		mockFetch.mockResolvedValue(new Response('<html></html>', { status: 200 }));

		await expect(provider().refreshPrices([product])).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('skips products with no variants or an unparseable price', async () => {
		const noVariants = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/a',
		});
		const badPrice = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/b',
		});
		mockFetch
			.mockResolvedValueOnce(jsonResponse(shopifyProduct([])))
			.mockResolvedValueOnce(jsonResponse(shopifyProduct(['n/a'])));

		await expect(
			provider().refreshPrices([noVariants, badPrice]),
		).resolves.toEqual({ updated: [], notUpdated: [noVariants, badPrice] });
	});

	it('skips products with an invalid url without fetching', async () => {
		const product = buildProduct({ productMerchantUrl: 'not a url' });

		await expect(provider().refreshPrices([product])).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('request construction', () => {
	it.each([
		[
			'https://shop.example.com/products/thing',
			'https://shop.example.com/products/thing.json',
		],
		[
			'https://shop.example.com/products/thing/',
			'https://shop.example.com/products/thing.json',
		],
		[
			'https://shop.example.com/products/thing?variant=123&ref=abc#reviews',
			'https://shop.example.com/products/thing.json',
		],
		[
			'https://shop.example.com/collections/sale/products/thing',
			'https://shop.example.com/collections/sale/products/thing.json',
		],
	])('requests %s as %s', async (productMerchantUrl, expected) => {
		mockFetch.mockResolvedValue(jsonResponse({}, 404));

		await provider().refreshPrices([buildProduct({ productMerchantUrl })]);

		expect(requestedUrl()).toBe(expected);
	});
});

describe('retry behaviour', () => {
	it('retries once when a request fails and succeeds on the second attempt', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/thing',
		});
		mockFetch
			.mockResolvedValueOnce(jsonResponse({}, 500))
			.mockResolvedValueOnce(jsonResponse(shopifyProduct(['7.00'])));

		const pending = provider().refreshPrices([product]);
		await jest.advanceTimersByTimeAsync(3000);
		const {
			updated: [updated],
		} = await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(updated).toMatchObject({ price: 7, currency: 'GBP' });
	});

	it('resolves with no updates when both attempts fail, rather than rejecting', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/thing',
		});
		mockFetch.mockResolvedValue(jsonResponse({}, 500));

		const pending = provider().refreshPrices([product]);
		await jest.advanceTimersByTimeAsync(3000);

		await expect(pending).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(mockRegisterMetric).toHaveBeenCalledWith(
			'ShopifyProductsFetched',
			0,
		);
	});
});
