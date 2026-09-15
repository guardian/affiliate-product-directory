import { jest } from '@jest/globals';
import { mockRegisterMetric } from '@mocks/CloudwatchMock';
import { buildProduct } from '@mocks/ProductFixtures';
import type * as AmazonAuthModule from './amazonAuth';
import type * as AmazonPriceProviderModule from './AmazonPriceProvider';

const mockGetAmazonCredentials =
	jest.fn<typeof AmazonAuthModule.getAmazonCredentials>();
const mockGetAmazonAccessToken =
	jest.fn<typeof AmazonAuthModule.getAmazonAccessToken>();

jest.unstable_mockModule(
	'@price-update/price-providers/amazon/amazonAuth',
	() => ({
		getAmazonCredentials: mockGetAmazonCredentials,
		getAmazonAccessToken: mockGetAmazonAccessToken,
	}),
);

let AmazonPriceProvider: typeof AmazonPriceProviderModule.AmazonPriceProvider;

beforeAll(async () => {
	({ AmazonPriceProvider } = await import('./AmazonPriceProvider'));
});

const credentials = {
	clientId: { UK: 'uk-client-id', US: 'us-client-id' },
	clientSecret: { UK: 'uk-client-secret', US: 'us-client-secret' },
	partnerTag: { UK: 'uk-partner-tag', US: 'us-partner-tag' },
};

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock<typeof fetch>;

/** A single Amazon item with one Buy Box listing, unless overridden. */
function item(
	asin: string,
	{
		price,
		currency,
		isBuyBoxWinner = true,
	}: { price: number; currency: string; isBuyBoxWinner?: boolean },
) {
	return {
		asin,
		offersV2: {
			listings: [
				{
					isBuyBoxWinner,
					price: { money: { amount: price, currency } },
				},
			],
		},
	};
}

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		status: ok ? 200 : 400,
		statusText: ok ? 'OK' : 'Bad Request',
		json: () => Promise.resolve(body),
	} as unknown as Response;
}

function requestBody(callIndex = 0): Record<string, unknown> {
	const [, init] = mockFetch.mock.calls[callIndex]!;
	return JSON.parse((init as RequestInit).body as string) as Record<
		string,
		unknown
	>;
}

function requestHeaders(callIndex = 0): Record<string, string> {
	const [, init] = mockFetch.mock.calls[callIndex]!;
	return (init as RequestInit).headers as Record<string, string>;
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(console, 'log').mockImplementation(() => {});
	mockGetAmazonCredentials.mockResolvedValue(credentials);
	mockGetAmazonAccessToken.mockImplementation((region) =>
		Promise.resolve(`${region.toLowerCase()}-token`),
	);
	mockRegisterMetric.mockResolvedValue();
	mockFetch = jest.fn<typeof fetch>();
	globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
	jest.useRealTimers();
});

function provider() {
	return new AmazonPriceProvider();
}

/** Advances past every throttle sleep between fetch calls without waiting in real time. */
async function flushThrottle(time = 1) {
	await jest.advanceTimersByTimeAsync(1000 * time);
}

describe('refreshPrices', () => {
	it('returns products updated with the Buy Box price', async () => {
		jest.useFakeTimers();
		const staleUpdatedAt = Date.now() - 60_000;
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0C3HCD34R',
			region: 'UK',
			price: 10,
			currency: 'GBP',
			updatedAt: staleUpdatedAt,
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				itemsResult: {
					items: [item('B0C3HCD34R', { price: 31.99, currency: 'GBP' })],
				},
			}),
		);

		const pending = provider().refreshPrices([product]);
		await flushThrottle();
		const [updated] = await pending;

		expect(updated).toMatchObject({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0C3HCD34R',
			price: 31.99,
			currency: 'GBP',
			updatedBy: 'amazon',
		});
		expect(updated!.updatedAt).toBeGreaterThan(staleUpdatedAt);
		expect(mockRegisterMetric).toHaveBeenCalledWith('AmazonProductsFetched', 1);
	});

	it('skips products whose URL has no extractable ASIN', async () => {
		const noAsin = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/some-product-page',
		});

		const result = await provider().refreshPrices([noAsin]);

		expect(result).toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('ignores listings that are not the Buy Box winner', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.com/dp/B0EXAMPLE1',
			region: 'US',
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				itemsResult: {
					items: [
						{
							asin: 'B0EXAMPLE1',
							offersV2: {
								listings: [
									{
										isBuyBoxWinner: false,
										price: { money: { amount: 49.99, currency: 'USD' } },
									},
									{
										isBuyBoxWinner: true,
										price: { money: { amount: 29.99, currency: 'USD' } },
									},
								],
							},
						},
					],
				},
			}),
		);

		const pending = provider().refreshPrices([product]);
		await flushThrottle();
		const [updated] = await pending;

		expect(updated).toMatchObject({ price: 29.99, currency: 'USD' });
	});

	it('skips products with no Buy Box winner listing', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0EXAMPLE2',
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				itemsResult: {
					items: [
						item('B0EXAMPLE2', {
							price: 12.99,
							currency: 'GBP',
							isBuyBoxWinner: false,
						}),
					],
				},
			}),
		);

		const pending = provider().refreshPrices([product]);
		await flushThrottle();

		await expect(pending).resolves.toEqual([]);
	});

	it('skips products the API returns no item for', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0MISSING1',
		});
		mockFetch.mockResolvedValue(jsonResponse({ itemsResult: { items: [] } }));

		const pending = provider().refreshPrices([product]);
		await flushThrottle();

		await expect(pending).resolves.toEqual([]);
	});

	it('sends a separate request per region with that region marketplace and token', async () => {
		jest.useFakeTimers();
		const uk = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0UKPROD01',
			region: 'UK',
		});
		const us = buildProduct({
			productMerchantUrl: 'https://www.amazon.com/dp/B0USPROD01',
			region: 'US',
		});
		mockFetch.mockResolvedValue(jsonResponse({ itemsResult: { items: [] } }));

		const pending = provider().refreshPrices([us, uk]);
		await flushThrottle(2);
		await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		// REGIONS order is UK then US regardless of input order.
		expect(requestBody(0)).toMatchObject({
			marketplace: 'www.amazon.co.uk',
			partnerTag: 'uk-partner-tag',
		});
		expect(requestHeaders(0)).toMatchObject({
			Authorization: 'Bearer uk-token',
			'x-marketplace': 'www.amazon.co.uk',
		});
		expect(requestBody(1)).toMatchObject({
			marketplace: 'www.amazon.com',
			partnerTag: 'us-partner-tag',
		});
		expect(requestHeaders(1)).toMatchObject({
			Authorization: 'Bearer us-token',
			'x-marketplace': 'www.amazon.com',
		});
	});

	it('splits a region into batches of 10 ASINs', async () => {
		jest.useFakeTimers();
		const products = Array.from({ length: 15 }, (_, i) =>
			buildProduct({
				productMerchantUrl: `https://www.amazon.co.uk/dp/B0BATCH${String(i).padStart(3, '0')}`,
				region: 'UK',
			}),
		);
		mockFetch.mockResolvedValue(jsonResponse({ itemsResult: { items: [] } }));

		const pending = provider().refreshPrices(products);
		await flushThrottle(2);
		await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect((requestBody(0).itemIds as string[]).length).toBe(10);
		expect((requestBody(1).itemIds as string[]).length).toBe(5);
		expect(mockRegisterMetric).toHaveBeenNthCalledWith(
			1,
			'AmazonProductsFetched',
			10,
		);
		expect(mockRegisterMetric).toHaveBeenNthCalledWith(
			2,
			'AmazonProductsFetched',
			5,
		);
	});
});

describe('request construction', () => {
	it('posts the ASINs with itemIdType, marketplace and partner tag', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0C3HCD34R',
			region: 'UK',
		});
		mockFetch.mockResolvedValue(jsonResponse({ itemsResult: { items: [] } }));

		const pending = provider().refreshPrices([product]);
		await flushThrottle();
		await pending;

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(requestBody()).toMatchObject({
			itemIds: ['B0C3HCD34R'],
			itemIdType: 'ASIN',
			marketplace: 'www.amazon.co.uk',
			partnerTag: 'uk-partner-tag',
		});
		expect(requestHeaders()).toMatchObject({
			'Content-Type': 'application/json',
			Authorization: 'Bearer uk-token',
			'x-marketplace': 'www.amazon.co.uk',
		});
	});

	it('extracts the ASIN from a /gp/product/ URL', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.com/gp/product/B0GPPROD01',
			region: 'US',
		});
		mockFetch.mockResolvedValue(jsonResponse({ itemsResult: { items: [] } }));

		const pending = provider().refreshPrices([product]);
		await flushThrottle();
		await pending;

		expect(requestBody().itemIds).toEqual(['B0GPPROD01']);
	});
});

describe('retry behaviour', () => {
	it('retries once when a request fails and succeeds on the second attempt', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0RETRYOK1',
		});
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, false))
			.mockResolvedValueOnce(
				jsonResponse({
					itemsResult: {
						items: [item('B0RETRYOK1', { price: 7, currency: 'GBP' })],
					},
				}),
			);

		const pending = provider().refreshPrices([product]);
		await jest.advanceTimersByTimeAsync(3000);
		await flushThrottle();
		const [updated] = await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(updated).toMatchObject({ price: 7, currency: 'GBP' });
	});

	it('resolves with no updates when both attempts fail, rather than rejecting', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/B0RETRYBAD',
		});
		mockFetch.mockResolvedValue(jsonResponse({ error: 'boom' }, false));

		const pending = provider().refreshPrices([product]);
		await jest.advanceTimersByTimeAsync(3000);
		await flushThrottle();
		const result = await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result).toEqual([]);
	});
});
