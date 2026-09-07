import { jest } from '@jest/globals';
import type { Product } from '@price-update/models';

const mockSkimlinksRefreshPrices =
	jest.fn<(products: Product[]) => Promise<Product[]>>();

jest.unstable_mockModule(
	'@price-update/price-providers/skimlinks/SkimlinksPriceProvider',
	() => ({
		SkimlinksPriceProvider: jest.fn(() => ({
			refreshPrices: mockSkimlinksRefreshPrices,
		})),
	}),
);

export { mockSkimlinksRefreshPrices };
