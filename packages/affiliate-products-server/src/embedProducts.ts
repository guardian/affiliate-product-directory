import { EmbedProductsRequestSchema } from '@common/embed';
import type { EmbedProductsResponse } from '@common/embed';
import type { Product as StoredProduct } from '@common/models';
import { createProductPrices } from './productPrices';

type Result =
	{ ok: true; body: EmbedProductsResponse } | { ok: false; error: string };

/**
 * The directory's prices for the URLs the embed has sent. URLs not yet in the directory
 * are previewed, and successfully priced products are saved.
 */
export const embedProducts = async (
	request: unknown,
	getProductsByUrl: (urls: string[]) => Promise<StoredProduct[]>,
	getPreviewPrices: (products: StoredProduct[]) => Promise<StoredProduct[]>,
): Promise<Result> => {
	const message = EmbedProductsRequestSchema.safeParse(request);
	if (!message.success) {
		return { ok: false, error: message.error.message };
	}

	const { region, urls } = message.data;

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
			prices: Object.fromEntries(
				urls.map((url) => [
					url,
					{
						...prices.get(url),
						...(!inDirectory.has(url) && { notInDirectory: true }),
					},
				]),
			),
		},
	};
};
