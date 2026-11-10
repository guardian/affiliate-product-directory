import { z } from 'zod';

export const PreviewRequestSchema = z.object({
	products: z
		.object({
			productMerchantUrl: z.string(),
			region: z.enum(['GB', 'US']),
		})
		.array(),
});

export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
