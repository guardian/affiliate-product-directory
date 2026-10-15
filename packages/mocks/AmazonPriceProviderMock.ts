import { jest } from '@jest/globals';
import type { Product } from '@common/models';
import type { PriceRefreshResult } from '@price-update/price-providers/PriceProvider';

const mockAmazonRefreshPrices =
	jest.fn<(products: Product[]) => Promise<PriceRefreshResult>>();

jest.unstable_mockModule(
	'@price-update/price-providers/amazon/AmazonPriceProvider',
	() => ({
		AmazonPriceProvider: jest.fn(() => ({
			refreshPrices: mockAmazonRefreshPrices,
		})),
	}),
);

export { mockAmazonRefreshPrices };
