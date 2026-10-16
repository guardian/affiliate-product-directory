// The shapes sent between the affiliate tool's server and client. The client checks
// responses against these schemas, so this file is bundled into it and should only
// import zod.

import { z } from 'zod';

/** The CAPI sections the tool lists articles from. */
export const SectionSchema = z.enum(['thefilter', 'thefilter-us']);

/** How many articles are listed on each page. */
export const articlesPageSize = 25;

/** A link to buy a product at one retailer: a product button, or a link on a product card. */
export const ProductLinkSchema = z.object({
	url: z.string(),
	// The link's text, such as "£27 at Cult Beauty".
	label: z.string(),
	// Only links on a product card name their retailer.
	retailer: z.string().optional(),
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

/**
 * A product in an article, with its links to the retailers that sell it: a product card,
 * or a buying guide's bold product name and the product buttons after it.
 */
export const ProductSchema = z.object({
	// Missing for a product button with no product card or bold name before it.
	name: z.string().optional(),
	links: z.array(ProductLinkSchema),
});

export const ArticleSchema = z.object({
	id: z.string(),
	sectionId: z.string(),
	webPublicationDate: z.string(),
	webTitle: z.string(),
	webUrl: z.string(),
	// Missing if CAPI has no byline for the article.
	byline: z.string().optional(),
	// Missing if CAPI has no Composer ID for the article.
	composerUrl: z.string().optional(),
	ophanUrl: z.string(),
	products: z.array(ProductSchema),
});

/** The response from /api/articles. */
export const ArticlesPageSchema = z.object({
	articles: z.array(ArticleSchema),
	currentPage: z.number(),
	pages: z.number(),
	total: z.number(),
});

/**
 * The response from /api/link-counts: the links on an article as it's rendered on the
 * site, counted as the Affiliate Link Counter bookmarklet counts them.
 */
export const LinkCountsSchema = z.object({
	amazon: z.number(),
	skimlinks: z.number(),
	other: z.number(),
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
export type Product = z.infer<typeof ProductSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticlesPage = z.infer<typeof ArticlesPageSchema>;
export type LinkCounts = z.infer<typeof LinkCountsSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
