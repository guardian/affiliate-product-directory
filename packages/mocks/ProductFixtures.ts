import { randomUUID } from 'crypto';
import type { PricedProduct } from '@common/models';

export function buildProduct(
	overrides: Partial<PricedProduct> = {},
): PricedProduct {
	return {
		productMerchantUrl: `https://example.com/product-${randomUUID()}`,
		region: 'GB',
		updatedAt: Date.now(),
		updatedBy: 'test',
		price: 9.99,
		currency: 'GBP',
		...overrides,
	};
}
