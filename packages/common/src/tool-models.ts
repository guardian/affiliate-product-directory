// The shapes sent between the affiliate tool's server and client. The client checks
// responses against these schemas, so this file is bundled into it and should only
// import zod.

import { z } from 'zod';

/** The CAPI sections the tool lists articles from. */
export const SectionSchema = z.enum(['thefilter', 'thefilter-us']);

/** How many articles are listed on each page. */
export const articlesPageSize = 25;

/** A link to a product in an article: a product button, or a link on a product card. */
export const ProductLinkSchema = z.object({
	url: z.string(),
	// The link's text, such as "£27 at Cult Beauty".
	label: z.string(),
	// Only links on a product card have a product name.
	productName: z.string().optional(),
	// The price written in the article. Missing if the label has no £ or $ price.
	basePrice: z
		.object({ currencySymbol: z.string(), amount: z.number() })
		.optional(),
	// The product's latest price in the directory, with when it was set and by which price
	// provider. Missing if the directory doesn't have the product or hasn't priced it yet.
	currency: z.string().optional(),
	price: z.number().optional(),
	updatedAt: z.number().optional(),
	updatedBy: z.string().optional(),
});

export const ArticleSchema = z.object({
	id: z.string(),
	sectionId: z.string(),
	webPublicationDate: z.string(),
	webTitle: z.string(),
	webUrl: z.string(),
	// Missing if CAPI has no Composer ID for the article.
	composerUrl: z.string().optional(),
	ophanUrl: z.string(),
	products: z.array(ProductLinkSchema),
});

/** The response from /api/articles. */
export const ArticlesPageSchema = z.object({
	articles: z.array(ArticleSchema),
	currentPage: z.number(),
	pages: z.number(),
	total: z.number(),
});

export const UserSchema = z.object({
	email: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	avatarUrl: z.string().optional(),
});

/** The response from /api/auth. */
export const AuthResponseSchema = z.object({
	user: UserSchema,
	permissions: z.array(z.string()),
});

export type Section = z.infer<typeof SectionSchema>;
export type ProductLink = z.infer<typeof ProductLinkSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticlesPage = z.infer<typeof ArticlesPageSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
