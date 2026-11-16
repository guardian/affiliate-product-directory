import type { Product, Region } from '@common/models';
import { z } from 'zod';

export const REGIONS: Region[] = ['GB', 'US'];

export const groupByRegion = (
	products: Product[],
): Record<Region, Product[]> => {
	const byRegion: Record<Region, Product[]> = { GB: [], US: [] };
	for (const product of products) {
		byRegion[product.region].push(product);
	}
	return byRegion;
};

const SkimlinksMatchSchema = z.object({
	price: z.number(),
	currency: z.string(),
	// true in stock, false out of stock, null unknown.
	is_available: z.boolean().nullish(),
	// Stock at Skimlinks' last scrape: 'in-stock', 'out-of-stock', 'pre-order' or null.
	// Left as any string so that one unexpected value can't fail a whole batch.
	latest_availability: z.string().nullish(),
});
export const SkimlinksProductsResponseSchema = z.object({
	results: z.record(z.string(), z.array(SkimlinksMatchSchema)),
});

export type SkimlinksMatch = z.infer<typeof SkimlinksMatchSchema>;
export type SkimlinksProductsResponse = z.infer<
	typeof SkimlinksProductsResponseSchema
>;
