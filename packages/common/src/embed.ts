import { z } from 'zod';
import type { Region } from './models';
import { ProductLinkSchema } from './tool-models';
import type { Product } from './tool-models';

/**
 * The messages between Composer and the tool's /embed page, which Composer shows in an
 * iframe beside a draft. Composer builds against these too, so they can't change without
 * a new version.
 */
export const embedMessageVersion = 1;

/** Sent by the embed when it has loaded, so Composer sends it the article. */
export interface EmbedReadyMessage {
	source: 'affiliate-products';
	type: 'ready';
	version: typeof embedMessageVersion;
}

/** Sent by the embed whenever its height changes, so Composer can size the iframe. */
export interface EmbedHeightMessage {
	source: 'affiliate-products';
	type: 'height';
	version: typeof embedMessageVersion;
	height: number;
}

export type EmbedMessage = EmbedReadyMessage | EmbedHeightMessage;

/** The article Composer has open, sent after every ready and again after each edit. */
export const ComposerContentMessageSchema = z.object({
	source: z.literal('composer'),
	type: z.literal('content'),
	version: z.literal(embedMessageVersion),
	composerId: z.string(),
	section: z.string().nullable(),
	// The body's elements as Composer holds them. The embed turns them into CAPI's shape.
	elements: z.array(z.unknown()),
});

export type ComposerContentMessage = z.infer<
	typeof ComposerContentMessageSchema
>;

/**
 * The embed's request for the prices of a draft's products. The embed finds the products
 * itself and sends only their URLs, as the WAF in front of the tool blocks large bodies.
 */
export const EmbedProductsRequestSchema = z.object({
	// The region a URL the directory doesn't have yet is priced in.
	region: z.enum(['GB', 'US']),
	urls: z.array(z.string()),
});

export type EmbedProductsRequest = z.infer<typeof EmbedProductsRequestSchema>;

/**
 * The most URLs the embed sends in one request. The WAF blocks bodies over 8 KB, and 50
 * of the longest URLs in a 450-link gift guide came to 6.2 KB.
 */
export const embedRequestMaxUrls = 50;

/** A URL's price in the directory, and whether the directory has it at all. */
const EmbedLinkPriceSchema = ProductLinkSchema.pick({
	currency: true,
	price: true,
	updatedAt: true,
	updatedBy: true,
	expiresAt: true,
	availability: true,
	notInDirectory: true,
});

export const EmbedProductsResponseSchema = z.object({
	// By URL. Empty for a URL the directory has but hasn't priced.
	prices: z.record(z.string(), EmbedLinkPriceSchema),
});

export type EmbedProductsResponse = z.infer<typeof EmbedProductsResponseSchema>;

/** Adds the directory's price to each of the products' links that the response has. */
export const withEmbedPrices = (
	products: Product[],
	prices: EmbedProductsResponse['prices'],
): Product[] =>
	products.map((product) => ({
		...product,
		links: product.links.map((link) => ({ ...link, ...prices[link.url] })),
	}));

const composerOrigins = {
	PROD: ['https://composer.gutools.co.uk'],
	CODE: [
		'https://composer.code.dev-gutools.co.uk',
		'https://composer.local.dev-gutools.co.uk',
	],
};

/** The Composers that may frame a stage's tool and send it articles. */
export const composerOriginsForStage = (stage: string): string[] =>
	stage === 'PROD' ? composerOrigins.PROD : composerOrigins.CODE;

/**
 * The Composers whose messages the embed accepts, from the tool's own hostname. Locally,
 * the dev harness on the tool's own origin stands in for Composer.
 */
export const composerOriginsForHost = (location: {
	hostname: string;
	origin: string;
}): string[] => {
	if (location.hostname === 'affiliate-products.gutools.co.uk') {
		return composerOriginsForStage('PROD');
	}
	if (
		location.hostname === 'localhost' ||
		location.hostname === 'affiliate-products.local.dev-gutools.co.uk'
	) {
		return [...composerOriginsForStage('CODE'), location.origin];
	}
	return composerOriginsForStage('CODE');
};

/** The region an article's prices are in, from its section. */
export const sectionRegion = (section: string | null): Region =>
	section === 'thefilter-us' ? 'US' : 'GB';
