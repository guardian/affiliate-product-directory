export type Region = 'UK' | 'US';

export interface Product {
	productMerchantUrl: string;
	createdAt: number;
	region: string;
	updatedAt: number;
	updatedBy: string;
	price: number;
	currency: string;
}

export const REGIONS: Region[] = ['UK', 'US'];

export const regionOf = (product: Product): Region =>
	product.region.toLowerCase() === 'us' ? 'US' : 'UK';

export const groupByRegion = (
	products: Product[],
): Record<Region, Product[]> => {
	const byRegion: Record<Region, Product[]> = { UK: [], US: [] };
	for (const product of products) {
		byRegion[regionOf(product)].push(product);
	}
	return byRegion;
};
