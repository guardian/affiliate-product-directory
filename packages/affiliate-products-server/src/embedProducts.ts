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
 * not yet in the directory are previewed, and successfully priced products are saved.
 */
export const embedProducts = async (
	request: unknown,
	getProductsByUrl: (urls: string[]) => Promise<StoredProduct[]>,
	getPreviewPrices: (products: StoredProduct[]) => Promise<StoredProduct[]>,
): Promise<Result> => {
	const message = ComposerContentMessageSchema.safeParse(request);
	if (!message.success) {
		return { ok: false, error: message.error.message };
	}

	const region = sectionRegion(message.data.section);
	const products = extractProducts(
		composerElementsToBlocks(message.data.elements),
	);
	const urls = [
		...new Set(
			products.flatMap((product) => product.links.map((link) => link.url)),
		),
	];

	const stored = urls.length > 0 ? await getProductsByUrl(urls) : [];
	const storedUrls = new Set(
		stored.map((product) => product.productMerchantUrl),
	);
	const missingUrls = urls.filter((url) => !storedUrls.has(url));
	const previewed =
		missingUrls.length > 0
			? await getPreviewPrices(
					missingUrls.map((productMerchantUrl) => ({
						productMerchantUrl,
						region,
					})),
				)
			: [];
	const inDirectory = new Set(
		[...stored, ...previewed]
			.filter((product) => product.removed !== 'true')
			.map((product) => product.productMerchantUrl),
	);
	const prices = await createProductPrices(() =>
		Promise.resolve([...stored, ...previewed]),
	)(urls);
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
