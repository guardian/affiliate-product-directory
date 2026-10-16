import type { Product } from '@common/models';
import type { Article, ArticlesPage, Section, User } from '@common/tool-models';
import { z } from 'zod';

/** Returns the user a request's cookies belong to, or undefined if they aren't logged in. */
export type Authenticate = (
	cookieHeader: string | undefined,
) => Promise<User | undefined>;

/** Returns the names of the permissions granted to a user in the permissions service. */
export type ListPermissions = (email: string) => Promise<string[]>;

/** Returns whether a logged-in user may use the tool. */
export type HasAccess = (email: string) => Promise<boolean>;

export interface Auth {
	authenticate: Authenticate;
	hasAccess: HasAccess;
	listPermissions: ListPermissions;
	loginUrl: string;
}

/** Lists one section's articles, or both sections' if none is given. */
export type ListArticles = (
	page: number,
	section?: Section,
) => Promise<ArticlesPage>;

/** A product's price in the pricing table, with only the fields the tool uses, by its URL. */
export type ProductPrices = Map<
	string,
	Pick<Product, 'currency' | 'price' | 'updatedAt' | 'updatedBy'>
>;

/** Returns the directory's price for each of these URLs that is an active product with one. */
export type GetProductPrices = (urls: string[]) => Promise<ProductPrices>;

/** Gets one article by its CAPI ID, or undefined if there isn't one. */
export type GetArticle = (path: string) => Promise<Article | undefined>;

/** A price found in a link's label. */
export interface ExtractedPrice {
	entireMatch: string;
	numericPrice: number;
	currencySymbol: string;
	priceAsString: string;
}

const LinkElementSchema = z.object({
	type: z.string(),
	// Only link elements have this. Product buttons have the linkType 'product-button'.
	linkTypeData: z
		.object({
			url: z.string().optional(),
			label: z.string().optional(),
			linkType: z.string().optional(),
		})
		.optional(),
});

// CAPI sends empty strings for the parts of a product card link that haven't been filled in.
const ProductCtaSchema = z.object({
	url: z.string().default(''),
	text: z.string().default(''),
	retailer: z.string().default(''),
	price: z.string().default(''),
});

/** An element of an article's body, with only the fields the tool uses. */
const BlockElementSchema = LinkElementSchema.extend({
	// Only text elements have this.
	textTypeData: z.object({ html: z.string().optional() }).optional(),
	// Only product elements (product cards) have this.
	productTypeData: z
		.object({
			productName: z.string().optional(),
			brandName: z.string().optional(),
			productCtas: z.array(ProductCtaSchema).optional(),
			// The elements shown inside the card, which can include product buttons.
			content: z.array(LinkElementSchema).optional(),
		})
		.optional(),
});

const BlockSchema = z.object({
	elements: z.array(BlockElementSchema).optional(),
});

export type LinkElement = z.infer<typeof LinkElementSchema>;
export type ProductCta = z.infer<typeof ProductCtaSchema>;
export type BlockElement = z.infer<typeof BlockElementSchema>;
export type Block = z.infer<typeof BlockSchema>;

/** A result in CAPI's search response, with only the fields the tool uses. */
const SearchResultSchema = z.object({
	id: z.string(),
	sectionId: z.string(),
	webPublicationDate: z.string(),
	webTitle: z.string(),
	webUrl: z.string(),
	fields: z
		.object({
			internalComposerCode: z.string().optional(),
			byline: z.string().optional(),
		})
		.optional(),
	blocks: z.object({ body: z.array(BlockSchema).optional() }).optional(),
});

export type CapiResult = z.infer<typeof SearchResultSchema>;

/** CAPI's response for a single item, such as one article. */
export const ItemResponseSchema = z.object({
	response: z.object({ content: SearchResultSchema }),
});

export const SearchResponseSchema = z.object({
	response: z.object({
		currentPage: z.number(),
		pages: z.number(),
		total: z.number(),
		results: z.array(SearchResultSchema),
	}),
});
