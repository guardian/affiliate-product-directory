import { chunk } from '@common/chunk';
import { composerElementsToBlocks } from '@common/composerElements';
import {
	EmbedProductsResponseSchema,
	embedRequestMaxUrls,
	sectionRegion,
	withEmbedPrices,
} from '@common/embed';
import type {
	ComposerContentMessage,
	EmbedProductsRequest,
	EmbedProductsResponse,
} from '@common/embed';
import type { Region } from '@common/models';
import { extractProducts } from '@common/products';
import type { Product } from '@common/tool-models';

/** The products in a draft, with their prices in the directory. */
export interface EmbedProducts {
	region: Region;
	products: Product[];
}

export type EmbedProductsState =
	| { status: 'loaded'; response: EmbedProducts }
	| { status: 'unauthenticated' }
	| { status: 'forbidden' }
	| { status: 'error' };

type PricesState =
	| { status: 'loaded'; prices: EmbedProductsResponse['prices'] }
	| Exclude<EmbedProductsState, { status: 'loaded' }>;

/** The directory's prices for one request's URLs. */
const fetchPrices = async (
	request: EmbedProductsRequest,
	signal: AbortSignal,
): Promise<PricesState> => {
	const response = await fetch('/api/embed/products', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(request),
		signal,
	});
	if (response.status === 401) {
		return { status: 'unauthenticated' };
	}
	if (response.status === 403) {
		return { status: 'forbidden' };
	}
	if (!response.ok) {
		return { status: 'error' };
	}

	const body = EmbedProductsResponseSchema.safeParse(await response.json());
	if (!body.success) {
		console.error('Unexpected response from /api/embed/products', body.error);
		return { status: 'error' };
	}
	return { status: 'loaded', prices: body.data.prices };
};

/**
 * The products in the draft Composer has sent, with their prices in the directory. The
 * products are found here, and only their URLs are sent for pricing, in batches sent
 * together, as the WAF in front of the tool blocks large request bodies.
 */
export const fetchEmbedProducts = async (
	content: ComposerContentMessage,
	signal: AbortSignal,
): Promise<EmbedProductsState> => {
	const region = sectionRegion(content.section);
	const products = extractProducts(composerElementsToBlocks(content.elements));
	const urls = [
		...new Set(
			products.flatMap((product) => product.links.map((link) => link.url)),
		),
	];

	// A draft with no links still sends one request, which checks the editor is logged in.
	const batches = urls.length > 0 ? chunk(urls, embedRequestMaxUrls) : [[]];
	const results = await Promise.all(
		batches.map((batch) => fetchPrices({ region, urls: batch }, signal)),
	);

	const prices: EmbedProductsResponse['prices'] = {};
	for (const result of results) {
		if (result.status !== 'loaded') {
			return result;
		}
		Object.assign(prices, result.prices);
	}
	return {
		status: 'loaded',
		response: { region, products: withEmbedPrices(products, prices) },
	};
};
