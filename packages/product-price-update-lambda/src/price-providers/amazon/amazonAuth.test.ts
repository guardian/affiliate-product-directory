import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetParametersFromParameterStore } from '@mocks/ParameterStoreMock';
import type * as AmazonAuthModule from './amazonAuth';

const commonPath = '/TEST/test-stack/affiliate-product-directory/amazon';
const ukClientIdKey = `${commonPath}/products/clientId/UK`;
const usClientIdKey = `${commonPath}/products/clientId/US`;
const ukClientSecretKey = `${commonPath}/products/clientSecret/UK`;
const usClientSecretKey = `${commonPath}/products/clientSecret/US`;
const ukPartnerTagKey = `${commonPath}/products/partnerTag/UK`;
const usPartnerTagKey = `${commonPath}/products/partnerTag/US`;

const parameters = {
	[ukClientIdKey]: 'uk-client-id',
	[usClientIdKey]: 'us-client-id',
	[ukClientSecretKey]: 'uk-client-secret',
	[usClientSecretKey]: 'us-client-secret',
	[ukPartnerTagKey]: 'uk-partner-tag',
	[usPartnerTagKey]: 'us-partner-tag',
};

// Credentials and access tokens are cached at module scope, so every test
// re-imports the module to start from a cold cache.
function loadModule(): Promise<typeof AmazonAuthModule> {
	jest.resetModules();
	return import('./amazonAuth');
}

function jsonResponse(body: unknown, ok = true): Response {
	return { ok, json: () => body } as unknown as Response;
}

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock<typeof fetch>;

beforeEach(() => {
	jest.clearAllMocks();
	mockGetParametersFromParameterStore.mockResolvedValue(parameters);
	mockFetch = jest.fn<typeof fetch>();
	globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('getAmazonCredentials', () => {
	it('maps the parameter store values into a credentials object', async () => {
		const { getAmazonCredentials } = await loadModule();

		await expect(getAmazonCredentials()).resolves.toEqual({
			clientId: { UK: 'uk-client-id', US: 'us-client-id' },
			clientSecret: { UK: 'uk-client-secret', US: 'us-client-secret' },
			partnerTag: { UK: 'uk-partner-tag', US: 'us-partner-tag' },
		});

		expect(mockGetParametersFromParameterStore).toHaveBeenCalledWith([
			ukClientIdKey,
			usClientIdKey,
			ukClientSecretKey,
			usClientSecretKey,
			ukPartnerTagKey,
			usPartnerTagKey,
		]);
	});

	it('caches the credentials across calls', async () => {
		const { getAmazonCredentials } = await loadModule();

		const first = await getAmazonCredentials();
		const second = await getAmazonCredentials();

		expect(second).toBe(first);
		expect(mockGetParametersFromParameterStore).toHaveBeenCalledTimes(1);
	});

	it('propagates a failure from the parameter store', async () => {
		const error = new Error('SSM is unavailable');
		mockGetParametersFromParameterStore.mockRejectedValue(error);
		const { getAmazonCredentials } = await loadModule();

		await expect(getAmazonCredentials()).rejects.toThrow(error);
	});
});

describe('getAmazonAccessToken', () => {
	it('requests a token with the client credentials grant for the given region', async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({ access_token: 'uk-token', expires_in: 3600 }),
		);
		const { getAmazonAccessToken } = await loadModule();

		await expect(getAmazonAccessToken('UK')).resolves.toBe('uk-token');

		expect(mockFetch).toHaveBeenCalledWith(
			'https://api.amazon.co.uk/auth/o2/token',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'client_credentials',
					client_id: 'uk-client-id',
					client_secret: 'uk-client-secret',
					scope: 'creatorsapi::default',
				}),
			},
		);
	});

	it('caches the access token across calls within the same region', async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({ access_token: 'uk-token', expires_in: 3600 }),
		);
		const { getAmazonAccessToken } = await loadModule();

		await getAmazonAccessToken('UK');
		await getAmazonAccessToken('UK');

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('caches UK and US tokens independently', async () => {
		mockFetch
			.mockResolvedValueOnce(
				jsonResponse({ access_token: 'uk-token', expires_in: 3600 }),
			)
			.mockResolvedValueOnce(
				jsonResponse({ access_token: 'us-token', expires_in: 3600 }),
			);
		const { getAmazonAccessToken } = await loadModule();

		await expect(getAmazonAccessToken('UK')).resolves.toBe('uk-token');
		await expect(getAmazonAccessToken('US')).resolves.toBe('us-token');

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(mockFetch).toHaveBeenNthCalledWith(
			1,
			'https://api.amazon.co.uk/auth/o2/token',
			expect.objectContaining({
				body: JSON.stringify({
					grant_type: 'client_credentials',
					client_id: 'uk-client-id',
					client_secret: 'uk-client-secret',
					scope: 'creatorsapi::default',
				}),
			}),
		);
		expect(mockFetch).toHaveBeenNthCalledWith(
			2,
			'https://api.amazon.com/auth/o2/token',
			expect.objectContaining({
				body: JSON.stringify({
					grant_type: 'client_credentials',
					client_id: 'us-client-id',
					client_secret: 'us-client-secret',
					scope: 'creatorsapi::default',
				}),
			}),
		);
	});

	it('throws and logs the body when the response is not ok', async () => {
		const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch.mockResolvedValue(
			jsonResponse({ error: 'invalid_client' }, false),
		);
		const { getAmazonAccessToken } = await loadModule();

		await expect(getAmazonAccessToken('UK')).rejects.toThrow(
			'Failed to fetch Amazon credentials',
		);
		expect(consoleLog).toHaveBeenCalledWith(
			JSON.stringify({ error: 'invalid_client' }, null, 2),
		);

		consoleLog.mockRestore();
	});

	it('throws when the response has no access_token', async () => {
		mockFetch.mockResolvedValue(jsonResponse({ expires_in: 3600 }));
		const { getAmazonAccessToken } = await loadModule();

		await expect(getAmazonAccessToken('UK')).rejects.toThrow(
			'access_token missing from Amazon response',
		);
	});
});
