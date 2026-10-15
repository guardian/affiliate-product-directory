export type Region = 'GB' | 'US';
export interface Product {
	productMerchantUrl: string;
	createdAt: number;
	region: Region;
	updatedAt: number;
	updatedBy: string;
	removed?: string;
	removedAt?: number;
	// Both are missing until a price provider has priced the product.
	price?: number;
	currency?: string;
}

/** A product that a price provider has priced, in the latest run or an earlier one. */
export type PricedProduct = Product & { price: number; currency: string };
