import { jest } from '@jest/globals';
import { buildProduct } from '@mocks/ProductFixtures';
import { ZodError } from 'zod';
import type * as SkimlinksAuthModule from './skimlinksAuth';
import type * as SkimlinksPriceProviderModule from './SkimlinksPriceProvider';

const mockGetSkimlinksCredentials =
	jest.fn<typeof SkimlinksAuthModule.getSkimlinksCredentials>();
const mockGetSkimlinksAccessToken =
	jest.fn<typeof SkimlinksAuthModule.getSkimlinksAccessToken>();

jest.unstable_mockModule(
	'@price-update/price-providers/skimlinks/skimlinksAuth',
	() => ({
		getSkimlinksCredentials: mockGetSkimlinksCredentials,
		getSkimlinksAccessToken: mockGetSkimlinksAccessToken,
	}),
);

let SkimlinksPriceProvider: typeof SkimlinksPriceProviderModule.SkimlinksPriceProvider;

beforeAll(async () => {
	({ SkimlinksPriceProvider } = await import('./SkimlinksPriceProvider'));
});

const credentials = {
	publisherId: 'pub-1',
	clientId: 'client-1',
	clientSecret: 'secret-1',
	publisherDomainId: { UK: 'uk-domain', US: 'us-domain' },
};

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock<typeof fetch>;

/** A single Skimlinks match for a product. */
function match(price: number, currency: string, inputUrl = 'x') {
	return { input_url: inputUrl, price, currency };
}

function jsonResponse(body: unknown, ok = true): Response {
	return {
		ok,
		status: ok ? 200 : 400,
		statusText: ok ? 'OK' : 'Bad Request',
		json: () => Promise.resolve(body),
	} as unknown as Response;
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(console, 'log').mockImplementation(() => {});
	mockGetSkimlinksCredentials.mockResolvedValue(credentials);
	mockGetSkimlinksAccessToken.mockResolvedValue('access-token-1');
	mockFetch = jest.fn<typeof fetch>();
	globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function provider() {
	return new SkimlinksPriceProvider();
}

function requestedUrl(callIndex = 0): URL {
	return new URL(mockFetch.mock.calls[callIndex]![0] as string);
}

describe('refreshPrices', () => {
	it('returns products updated with fetched details', async () => {
		const staleUpdatedAt = Date.now() - 60_000;
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
			region: 'UK',
			price: 10,
			currency: 'GBP',
			updatedAt: staleUpdatedAt,
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				results: { 'https://johnlewis.com/p/1': [match(24.5, 'GBP')] },
			}),
		);

		const [updated] = await provider().refreshPrices([product]);

		expect(updated).toMatchObject({
			productMerchantUrl: 'https://johnlewis.com/p/1',
			region: 'UK',
			price: 24.5,
			currency: 'GBP',
			updatedBy: 'skimlinks',
		});
		expect(updated!.updatedAt).toBeGreaterThan(staleUpdatedAt);
	});

	it('throws if payload is on unexpected shape', async () => {
		const staleUpdatedAt = Date.now() - 60_000;
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
			region: 'UK',
			price: 10,
			currency: 'GBP',
			updatedAt: staleUpdatedAt,
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				results: {
					'https://johnlewis.com/p/1': [
						{ input_url: 'url1', price: 25, currency: 'madeup' },
						{ input_urla: 'url1', price: 25, currency: 'madeup' },
					],
				},
			}),
		);

		await expect(provider().refreshPrices([product])).rejects.toThrow(ZodError);
	});

	it('skips products the API returns no data for', async () => {
		const matched = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
		});
		const unmatched = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/2',
		});
		mockFetch.mockResolvedValue(
			jsonResponse({
				results: { 'https://johnlewis.com/p/1': [match(5, 'GBP')] },
			}),
		);

		const result = await provider().refreshPrices([matched, unmatched]);

		expect(result).toEqual([matched]);
	});

	it('skips products that come back with an empty match array', async () => {
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
		});
		mockFetch.mockResolvedValue(
			jsonResponse({ results: { 'https://johnlewis.com/p/1': [] } }),
		);

		await expect(provider().refreshPrices([product])).resolves.toEqual([]);
	});
});

describe('request construction', () => {
	it('posts the product merchant urls with the auth and query parameters', async () => {
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
			region: 'UK',
		});
		mockFetch.mockResolvedValue(jsonResponse({ results: {} }));

		await provider().refreshPrices([product]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [, init] = mockFetch.mock.calls[0]!;
		expect(init).toMatchObject({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ product_urls: ['https://johnlewis.com/p/1'] }),
		});

		// checks that all query params were added
		const url = requestedUrl();
		expect(url.origin + url.pathname).toBe(
			'https://products.skimapis.com/v1/publisher/pub-1/products',
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			access_token: 'access-token-1',
			publisher_domain_id: 'uk-domain',
			exclude_domains: '',
			referrer_url: 'theguardian.com',
			per_merchant_limit: '1',
			country_code: 'GB',
			product_id_type: 'asin',
			alternatives_size: '0',
		});
	});

	it("sends a separate request per region with that region's domain id and country code", async () => {
		const uk = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/uk',
			region: 'UK',
		});
		const us = buildProduct({
			productMerchantUrl: 'https://target.com/us',
			region: 'US',
		});
		mockFetch.mockResolvedValue(jsonResponse({ results: {} }));

		await provider().refreshPrices([us, uk]);

		expect(mockFetch).toHaveBeenCalledTimes(2);
		// REGIONS order is UK then US regardless of input order.
		expect(requestedUrl(0).searchParams.get('country_code')).toBe('GB');
		expect(requestedUrl(0).searchParams.get('publisher_domain_id')).toBe(
			'uk-domain',
		);
		expect(requestedUrl(1).searchParams.get('country_code')).toBe('US');
		expect(requestedUrl(1).searchParams.get('publisher_domain_id')).toBe(
			'us-domain',
		);
	});

	it('merges matches across batches', async () => {
		const products = Array.from({ length: 150 }, (_, i) =>
			buildProduct({
				productMerchantUrl: `https://johnlewis.com/p/${i}`,
				region: 'UK',
			}),
		);
		mockFetch
			.mockResolvedValueOnce(
				jsonResponse({
					results: { 'https://johnlewis.com/p/0': [match(1, 'GBP')] },
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: { 'https://johnlewis.com/p/149': [match(2, 'USD')] },
				}),
			);

		const result = await provider().refreshPrices(products);

		expect(
			result.map((p) => [p.productMerchantUrl, p.price, p.currency]),
		).toEqual([
			['https://johnlewis.com/p/0', 1, 'GBP'],
			['https://johnlewis.com/p/149', 2, 'USD'],
		]);
	});
});

describe('retry behaviour', () => {
	it('retries once when a request fails and succeeds on the second attempt', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
		});
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, false))
			.mockResolvedValueOnce(
				jsonResponse({
					results: { 'https://johnlewis.com/p/1': [match(7, 'GBP')] },
				}),
			);

		const pending = provider().refreshPrices([product]);
		await jest.advanceTimersByTimeAsync(3000);
		const [updated] = await pending;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(updated).toMatchObject({ price: 7, currency: 'GBP' });
		jest.useRealTimers();
	});

	it('rejects when both attempts fail', async () => {
		jest.useFakeTimers();
		const product = buildProduct({
			productMerchantUrl: 'https://johnlewis.com/p/1',
		});
		mockFetch.mockResolvedValue(jsonResponse({ error: 'boom' }, false));

		const pending = provider().refreshPrices([product]);
		const assertion = expect(pending).rejects.toThrow(
			'Skimlinks products request failed: 400 Bad Request',
		);
		await jest.advanceTimersByTimeAsync(3000);
		await assertion;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		jest.useRealTimers();
	});
});
