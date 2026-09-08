import type { Product } from '@common/models';
import { z } from 'zod';

export type Region = 'UK' | 'US';

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

const SkimlinksMatchSchema = z.object({
	input_url: z.string(),
	price: z.number(),
	currency: z.string(),
});
export const SkimlinksProductsResponseSchema = z.object({
	results: z.record(z.string(), z.array(SkimlinksMatchSchema)),
});

export type SkimlinksMatch = z.infer<typeof SkimlinksMatchSchema>;
export type SkimlinksProductsResponse = z.infer<
	typeof SkimlinksProductsResponseSchema
>;
