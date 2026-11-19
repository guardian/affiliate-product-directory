import { z } from 'zod';

// Merchant URLs are always domain names, so rejecting IP literals and bare hosts like
// localhost blocks the obvious SSRF targets (loopback, private ranges, cloud metadata).
const publicUrlSchema = z.url({
	protocol: /^https?$/,
	hostname: z.regexes.domain,
	error: 'productMerchantUrl must be a valid public HTTP(S) URL',
});

export const PreviewRequestSchema = z.object({
	products: z
		.object({
			productMerchantUrl: publicUrlSchema,
			region: z.enum(['GB', 'US']),
		})
		.array(),
});

export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
