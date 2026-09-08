import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetParametersFromParameterStore } from '@mocks/ParameterStoreMock';
import type * as SkimlinksAuthModule from './skimlinksAuth';

const commonPath = '/TEST/test-stack/affiliate-product-directory/skimlinks';
const publisherIdKey = `${commonPath}/publisherId`;
const clientIdKey = `${commonPath}/products/clientId`;
const clientSecretKey = `${commonPath}/products/clientSecret`;
const ukPublisherDomainIdKey = `${commonPath}/products/publisherDomainId/UK`;
const usPublisherDomainIdKey = `${commonPath}/products/publisherDomainId/US`;

const parameters = {
	[publisherIdKey]: 'publisher-id',
	[clientIdKey]: 'client-id',
	[clientSecretKey]: 'client-secret',
	[ukPublisherDomainIdKey]: 'uk-domain-id',
	[usPublisherDomainIdKey]: 'us-domain-id',
};

// Credentials and the access token are cached at module scope, so every test
// re-imports the module to start from a cold cache.
function loadModule(): Promise<typeof SkimlinksAuthModule> {
	jest.resetModules();
	return import('./skimlinksAuth');
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

describe('getSkimlinksCredentials', () => {
	it('maps the parameter store values into a credentials object', async () => {
		const { getSkimlinksCredentials } = await loadModule();

		await expect(getSkimlinksCredentials()).resolves.toEqual({
			publisherId: 'publisher-id',
			clientId: 'client-id',
			clientSecret: 'client-secret',
			publisherDomainId: { UK: 'uk-domain-id', US: 'us-domain-id' },
		});

		expect(mockGetParametersFromParameterStore).toHaveBeenCalledWith([
			publisherIdKey,
			clientIdKey,
			clientSecretKey,
			ukPublisherDomainIdKey,
			usPublisherDomainIdKey,
		]);
	});

	it('caches the credentials across calls', async () => {
		const { getSkimlinksCredentials } = await loadModule();

		const first = await getSkimlinksCredentials();
		const second = await getSkimlinksCredentials();

		expect(second).toBe(first);
		expect(mockGetParametersFromParameterStore).toHaveBeenCalledTimes(1);
	});

	it('propagates a failure from the parameter store', async () => {
		const error = new Error('SSM is unavailable');
		mockGetParametersFromParameterStore.mockRejectedValue(error);
		const { getSkimlinksCredentials } = await loadModule();

		await expect(getSkimlinksCredentials()).rejects.toThrow(error);
	});
});

describe('getSkimlinksAccessToken', () => {
	it('requests a token with the client credentials grant and returns it', async () => {
		mockFetch.mockResolvedValue(jsonResponse({ access_token: 'the-token' }));
		const { getSkimlinksAccessToken } = await loadModule();

		await expect(getSkimlinksAccessToken()).resolves.toBe('the-token');

		expect(mockFetch).toHaveBeenCalledWith(
			'https://authentication.skimapis.com/access_token',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_id: 'client-id',
					client_secret: 'client-secret',
					grant_type: 'client_credentials',
				}),
			},
		);
	});

	it('caches the access token across calls', async () => {
		mockFetch.mockResolvedValue(jsonResponse({ access_token: 'the-token' }));
		const { getSkimlinksAccessToken } = await loadModule();

		await getSkimlinksAccessToken();
		await getSkimlinksAccessToken();

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('throws and logs the body when the response is not ok', async () => {
		const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch.mockResolvedValue(
			jsonResponse({ error: 'invalid_client' }, false),
		);
		const { getSkimlinksAccessToken } = await loadModule();

		await expect(getSkimlinksAccessToken()).rejects.toThrow(
			'Failed to fetch Skimlinks credentials',
		);
		expect(consoleLog).toHaveBeenCalledWith(
			JSON.stringify({ error: 'invalid_client' }, null, 2),
		);

		consoleLog.mockRestore();
	});

	it('throws when the response has no access_token', async () => {
		mockFetch.mockResolvedValue(jsonResponse({ expiry_timestamp: 123 }));
		const { getSkimlinksAccessToken } = await loadModule();

		await expect(getSkimlinksAccessToken()).rejects.toThrow(
			'access_token missing from Skimlinks response',
		);
	});
});
