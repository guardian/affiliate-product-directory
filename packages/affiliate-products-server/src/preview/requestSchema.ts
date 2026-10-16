import { z } from 'zod';

export const PreviewRequestSchema = z.object({
	productMerchantUrl: z.string(),
	region: z.enum(['GB', 'US']),
});

export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
