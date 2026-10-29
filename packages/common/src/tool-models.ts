// The shapes sent between the affiliate tool's server and client. The client checks
// responses against these schemas, so this file is bundled into it and should only
// import zod.

import { z } from 'zod';

/** The CAPI sections the tool lists articles from. */
export const SectionSchema = z.enum(['thefilter', 'thefilter-us']);

/** Whether an article is a draft that hasn't been published yet, or is live on the site. */
export const ArticleStatusSchema = z.enum(['draft', 'live']);

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
	// When a manual override of the price ends. Missing if it doesn't, or the price isn't one.
	expiresAt: z.number().optional(),
	// Whether the link goes to Amazon, through Skimlinks, or elsewhere, as the article's link
	// counts sort it. Missing if the Skimlinks domains couldn't be read.
	kind: z.enum(['amazon', 'skimlinks', 'other']).optional(),
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

/**
 * The external links in an article's body, repeats included, counted as the Affiliate Link
 * Counter bookmarklet counts the links on a rendered page.
 */
export const LinkCountsSchema = z.object({
	amazon: z.number(),
	// Links that are sent through Skimlinks when the article is rendered, other than Amazon's.
	skimlinks: z.number(),
	other: z.number(),
});

export const ArticleSchema = z.object({
	id: z.string(),
	sectionId: z.string(),
	status: ArticleStatusSchema,
	// Missing for a draft, which hasn't been published.
	webPublicationDate: z.string().optional(),
	// When the article was last changed in Composer. Missing if CAPI doesn't say.
	lastModified: z.string().optional(),
	webTitle: z.string(),
	// Missing for a draft, which isn't on the site yet.
	webUrl: z.string().optional(),
	// Missing if CAPI has no byline for the article.
	byline: z.string().optional(),
	// Whether the article is set to show live prices, though the site only does when
	// frontend's affiliate-product-live-pricing switch is on too.
	livePricing: z.boolean(),
	// Missing if CAPI has no Composer ID for the article.
	composerUrl: z.string().optional(),
	ophanUrl: z.string(),
	products: z.array(ProductSchema),
	// Missing if the Skimlinks domains couldn't be read.
	linkCounts: LinkCountsSchema.optional(),
});

/** The response from /api/articles. */
export const ArticlesPageSchema = z.object({
	// The drafts, which come before the live articles and aren't paged, so they're only on
	// the first page. Missing on later pages, when only live articles were asked for, or
	// when the tool can't list the drafts.
	drafts: z.array(ArticleSchema).optional(),
	// The page of live articles.
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
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;
export type ProductLink = z.infer<typeof ProductLinkSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticlesPage = z.infer<typeof ArticlesPageSchema>;
export type LinkCounts = z.infer<typeof LinkCountsSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
