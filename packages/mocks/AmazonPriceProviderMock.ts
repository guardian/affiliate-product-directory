import { jest } from '@jest/globals';
import type { Product } from '@common/models';

const mockAmazonRefreshPrices =
	jest.fn<(products: Product[]) => Promise<Product[]>>();

jest.unstable_mockModule(
	'@price-update/price-providers/amazon/AmazonPriceProvider',
	() => ({
		AmazonPriceProvider: jest.fn(() => ({
			refreshPrices: mockAmazonRefreshPrices,
		})),
	}),
);

export { mockAmazonRefreshPrices };
