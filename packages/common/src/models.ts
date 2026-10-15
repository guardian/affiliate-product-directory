export type Region = 'GB' | 'US';
export interface Product {
	productMerchantUrl: string;
	createdAt: number;
	region: Region;
	updatedAt: number;
	updatedBy: string;
	removed?: string;
	removedAt?: number;
	price: number;
	currency: string;
}
