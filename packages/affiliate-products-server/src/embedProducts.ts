import { ComposerContentMessageSchema, sectionRegion } from '@common/embed';
import type { EmbedProductsResponse } from '@common/embed';
import type { Product as StoredProduct } from '@common/models';
import { composerElementsToBlocks } from './composerElements';
import { createProductPrices } from './productPrices';
import { extractProducts } from './products';

type Result =
	| { ok: true; body: EmbedProductsResponse }
	| { ok: false; error: string };

/**
 * The products in the draft Composer has sent, with their prices in the directory. Links
 * the directory doesn't have yet are marked, as they won't get a live price until the
 * article is published and the next price run has priced them.
 */
export const embedProducts = async (
	request: unknown,
	getProductsByUrl: (urls: string[]) => Promise<StoredProduct[]>,
): Promise<Result> => {
	const message = ComposerContentMessageSchema.safeParse(request);
	if (!message.success) {
		return { ok: false, error: message.error.message };
	}

	const region = sectionRegion(message.data.section);
	const products = extractProducts(
		composerElementsToBlocks(message.data.elements),
	);
	const urls = products.flatMap((product) =>
		product.links.map((link) => link.url),
	);

	const stored = urls.length > 0 ? await getProductsByUrl(urls) : [];
	const inDirectory = new Set(
		stored
			.filter((product) => product.removed !== 'true')
			.map((product) => product.productMerchantUrl),
	);
	const prices = await createProductPrices(() => Promise.resolve(stored))(urls);

	// Live prices for the links not in the directory will come from the price providers
	// here, through ProductsUpdater.getPreviewPrices with this region, once it's decided
	// whether a preview should write them to the pricing table.
	return {
		ok: true,
		body: {
			region,
			products: products.map((product) => ({
				...product,
				links: product.links.map((link) => ({
					...link,
					...prices.get(link.url),
					...(!inDirectory.has(link.url) && { notInDirectory: true }),
				})),
			})),
		},
	};
};
