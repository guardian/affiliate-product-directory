import { z } from 'zod';

export const ManualOverrideRequestSchema = z.object({
	productMerchantUrl: z.string(),
	currency: z.string(),
	price: z.number(),
	expiryDate: z.date().optional(),
});

export type ManualOverrideRequest = z.infer<typeof ManualOverrideRequestSchema>;
