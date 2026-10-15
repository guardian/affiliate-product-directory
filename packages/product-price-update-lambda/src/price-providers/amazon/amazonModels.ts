import { z } from 'zod';

const AmazonMoneySchema = z.object({
	amount: z.number(),
	currency: z.string(),
});

const AmazonListingSchema = z.object({
	isBuyBoxWinner: z.boolean().optional(),
	price: z
		.object({
			money: AmazonMoneySchema,
			savingBasis: z.unknown().optional(),
			savings: z.unknown().optional(),
		})
		.optional(),
	availability: z.unknown().optional(),
	condition: z.unknown().optional(),
	merchantInfo: z.unknown().optional(),
	dealDetails: z.unknown().optional(),
	violatesMAP: z.boolean().optional(),
});

const AmazonItemSchema = z.object({
	asin: z.string(),
	detailPageURL: z.string().optional(),
	itemInfo: z.unknown().optional(),
	offersV2: z
		.object({
			listings: z.array(AmazonListingSchema).optional(),
		})
		.optional(),
});

export const AmazonGetItemsResponseSchema = z.object({
	itemsResult: z
		.object({
			items: z.array(AmazonItemSchema).default([]),
		})
		.optional(),
	errors: z.array(z.unknown()).optional(),
});

export type AmazonGetItemsResponse = z.infer<
	typeof AmazonGetItemsResponseSchema
>;
export type AmazonItem = z.infer<typeof AmazonItemSchema>;
export type AmazonListing = z.infer<typeof AmazonListingSchema>;
