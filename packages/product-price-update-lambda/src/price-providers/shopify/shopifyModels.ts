import { z } from 'zod';

const ShopifyVariantSchema = z.object({
	id: z.number().optional(),
	price: z.string(),
	price_currency: z.enum(['GBP', 'USD']),
});

/** The shape of a Shopify storefront's `/products/<handle>.json` response. */
export const ShopifyProductResponseSchema = z.object({
	product: z.object({
		id: z.number().optional(),
		handle: z.string().optional(),
		variants: z.array(ShopifyVariantSchema),
	}),
});

export type ShopifyProductResponse = z.infer<
	typeof ShopifyProductResponseSchema
>;
export type ShopifyVariant = z.infer<typeof ShopifyVariantSchema>;
