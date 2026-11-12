import { z } from 'zod';

export const ManualOverrideRequestSchema = z.object({
	productMerchantUrl: z.string(),
	currency: z.enum(['GBP', 'USD']),
	price: z.number(),
	expiryDate: z.coerce.date().optional(),
	// Only sent for a draft's product, which the directory may not have yet. The product is
	// then added to the directory, with this price, in this region.
	region: z.enum(['GB', 'US']).optional(),
});

export const ManualOverrideDeleteRequestSchema = z.object({
	productMerchantUrl: z.string(),
});

export type ManualOverrideRequest = z.infer<typeof ManualOverrideRequestSchema>;
export type ManualOverrideDeleteRequest = z.infer<
	typeof ManualOverrideDeleteRequestSchema
>;
