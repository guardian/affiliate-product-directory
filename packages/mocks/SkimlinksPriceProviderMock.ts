import { jest } from '@jest/globals';
import type { Product } from '@common/models';
import type { PriceRefreshResult } from '@price-update/price-providers/PriceProvider';

const mockSkimlinksRefreshPrices =
	jest.fn<(products: Product[]) => Promise<PriceRefreshResult>>();

jest.unstable_mockModule(
	'@price-update/price-providers/skimlinks/SkimlinksPriceProvider',
	() => ({
		SkimlinksPriceProvider: jest.fn(() => ({
			refreshPrices: mockSkimlinksRefreshPrices,
		})),
	}),
);

export { mockSkimlinksRefreshPrices };
