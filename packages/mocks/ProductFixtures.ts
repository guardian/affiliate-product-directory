import { randomUUID } from 'crypto';
import type { Product } from '@common/models';

export function buildProduct(overrides: Partial<Product> = {}): Product {
	return {
		productMerchantUrl: `https://example.com/product-${randomUUID()}`,
		createdAt: Date.now(),
		region: 'UK',
		updatedAt: Date.now(),
		updatedBy: 'test',
		price: 9.99,
		currency: 'GBP',
		...overrides,
	};
}
