export interface Product {
	productMerchantUrl: string;
	createdAt: number;
	region: string;
	updatedAt: number;
	updatedBy: string;
	removed?: string;
	removedAt?: number;
	price: number;
	currency: string;
}
