import type { Product } from '@common/models';
import type { ArticlesPage } from '@common/tool-models';
import type { GetProductPrices, ProductPrices } from './types';

/**
 * Looks up the directory's prices in the pricing table on every call, so the tool always
 * shows the table as it is. Products that have been removed from the directory, or that
 * haven't been priced yet, are left out.
 */
export const createProductPrices =
	(
		getProductsByUrl: (urls: string[]) => Promise<Product[]>,
	): GetProductPrices =>
	async (urls) => {
		const products = await getProductsByUrl(urls);
		return new Map(
			products
				.filter(
					(product) =>
						product.removed !== 'true' &&
						product.price !== undefined &&
						product.currency !== undefined,
				)
				.map(
					({ productMerchantUrl, currency, price, updatedAt, updatedBy }) => [
						productMerchantUrl,
						{ currency, price, updatedAt, updatedBy },
					],
				),
		);
	};

/** The URL of every product on the page, each once. */
export const productUrls = (page: ArticlesPage): string[] => [
	...new Set(
		page.articles.flatMap((article) =>
			article.products.map((product) => product.url),
		),
	),
];

/** Adds the directory's price to each of the articles' products that it has one for. */
export const attachProductPrices = (
	page: ArticlesPage,
	prices: ProductPrices,
): ArticlesPage => ({
	...page,
	articles: page.articles.map((article) => ({
		...article,
		products: article.products.map((product) => ({
			...product,
			...prices.get(product.url),
		})),
	})),
});
