import type { Product } from '@common/models';
import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetParametersFromParameterStore } from '@mocks/ParameterStoreMock';
import { buildProduct } from '@mocks/ProductFixtures';
import type * as PriceProviderModule from './PriceProvider';

const enabledKey = '/TEST/test-stack/affiliate-product-directory/test/enabled';

let TestPriceProvider: new () => PriceProviderModule.PriceProvider;
const mockFetchPrices = jest.fn<(products: Product[]) => Promise<Product[]>>();

beforeAll(async () => {
	const { PriceProvider } = await import('./PriceProvider');

	TestPriceProvider = class extends PriceProvider {
		constructor() {
			super('test');
		}

		protected fetchPrices(products: Product[]): Promise<Product[]> {
			return mockFetchPrices(products);
		}
	};
});

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(console, 'log').mockImplementation(() => {});
	mockFetchPrices.mockImplementation((products) => Promise.resolve(products));
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('enabled parameter', () => {
	it('reads the enabled parameter for the provider name', async () => {
		mockGetParametersFromParameterStore.mockResolvedValue({
			[enabledKey]: 'true',
		});

		await new TestPriceProvider().refreshPrices([]);

		expect(mockGetParametersFromParameterStore).toHaveBeenCalledWith([
			enabledKey,
		]);
	});

	it('refreshes prices when enabled is true', async () => {
		mockGetParametersFromParameterStore.mockResolvedValue({
			[enabledKey]: 'true',
		});
		const product = buildProduct();

		await expect(
			new TestPriceProvider().refreshPrices([product]),
		).resolves.toEqual({ updated: [product], notUpdated: [] });
		expect(mockFetchPrices).toHaveBeenCalledWith([product]);
	});

	it('returns the products fetchPrices did not update as notUpdated', async () => {
		mockGetParametersFromParameterStore.mockResolvedValue({
			[enabledKey]: 'true',
		});
		const priced = buildProduct();
		const unpriced = buildProduct();
		mockFetchPrices.mockResolvedValue([priced]);

		const result = await new TestPriceProvider().refreshPrices([
			priced,
			unpriced,
		]);

		expect(result.updated).toEqual([priced]);
		expect(result.notUpdated).toHaveLength(1);
		expect(result.notUpdated[0]).toBe(unpriced);
	});

	it.each(['false', 'TRUE', 'yes', ''])(
		'returns every product as notUpdated when enabled is false',
		async (value) => {
			mockGetParametersFromParameterStore.mockResolvedValue({
				[enabledKey]: value,
			});
			const product = buildProduct();

			await expect(
				new TestPriceProvider().refreshPrices([product]),
			).resolves.toEqual({ updated: [], notUpdated: [product] });
			expect(mockFetchPrices).not.toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith(
				'test price provider is disabled, skipping 1 products',
			);
		},
	);

	it('treats a failed parameter store read as disabled', async () => {
		mockGetParametersFromParameterStore.mockRejectedValue(
			new Error('Parameters not found or have no value'),
		);

		const product = buildProduct();

		await expect(
			new TestPriceProvider().refreshPrices([product]),
		).resolves.toEqual({ updated: [], notUpdated: [product] });
		expect(mockFetchPrices).not.toHaveBeenCalled();
	});

	it('reads the value once per instance and not across instances', async () => {
		mockGetParametersFromParameterStore.mockResolvedValueOnce({
			[enabledKey]: 'true',
		});
		const first = new TestPriceProvider();
		await first.refreshPrices([]);
		await first.refreshPrices([]);

		mockGetParametersFromParameterStore.mockResolvedValueOnce({
			[enabledKey]: 'false',
		});
		const second = new TestPriceProvider();

		const product = buildProduct();

		await expect(second.refreshPrices([product])).resolves.toEqual({
			updated: [],
			notUpdated: [product],
		});
		expect(mockGetParametersFromParameterStore).toHaveBeenCalledTimes(2);
	});
});
