import { z } from 'zod';

export const ManualOverrideRequestSchema = z.object({
	productMerchantUrl: z.string(),
	currency: z.string(),
	price: z.number(),
	expiryDate: z.coerce.date().optional(),
});

export const ManualOverrideDeleteRequestSchema = z.object({
	productMerchantUrl: z.string(),
});

export type ManualOverrideRequest = z.infer<typeof ManualOverrideRequestSchema>;
export type ManualOverrideDeleteRequest = z.infer<
	typeof ManualOverrideDeleteRequestSchema
>;
