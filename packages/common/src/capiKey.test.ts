import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetParametersFromParameterStore } from '@mocks/ParameterStoreMock';
import type * as CapiKeyModule from './capiKey';

const capiKeyName = '/TEST/test-stack/affiliate-product-directory/capi-key';

// The key is cached at module scope, so every test re-imports the module to start from a
// cold cache.
function loadModule(): Promise<typeof CapiKeyModule> {
	jest.resetModules();
	return import('./capiKey');
}

beforeEach(() => {
	jest.clearAllMocks();
	mockGetParametersFromParameterStore.mockResolvedValue({
		[capiKeyName]: 'test-capi-key',
	});
});

describe('getCapiKey', () => {
	it("reads the stage's CAPI key from Parameter Store", async () => {
		const { getCapiKey } = await loadModule();

		await expect(getCapiKey()).resolves.toBe('test-capi-key');
		expect(mockGetParametersFromParameterStore).toHaveBeenCalledWith(
			[capiKeyName],
			true,
		);
	});

	it('reads the key only once', async () => {
		const { getCapiKey } = await loadModule();

		await getCapiKey();
		await getCapiKey();

		expect(mockGetParametersFromParameterStore).toHaveBeenCalledTimes(1);
	});

	it('reads the key again after a read fails', async () => {
		const { getCapiKey } = await loadModule();
		mockGetParametersFromParameterStore.mockRejectedValueOnce(
			new Error('SSM unavailable'),
		);

		await expect(getCapiKey()).rejects.toThrow('SSM unavailable');
		await expect(getCapiKey()).resolves.toBe('test-capi-key');
		expect(mockGetParametersFromParameterStore).toHaveBeenCalledTimes(2);
	});
});
