import { jest } from '@jest/globals';
import type { Product } from '@common/models';

const mockShopifyRefreshPrices =
	jest.fn<(products: Product[]) => Promise<Product[]>>();

jest.unstable_mockModule(
	'@price-update/price-providers/shopify/ShopifyPriceProvider',
	() => ({
		ShopifyPriceProvider: jest.fn(() => ({
			refreshPrices: mockShopifyRefreshPrices,
		})),
	}),
);

export { mockShopifyRefreshPrices };
