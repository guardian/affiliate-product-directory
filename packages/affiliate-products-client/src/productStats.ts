import type { Article } from '@common/tool-models';

/** How many links an article has to its products' retailers. */
export const retailerLinkCount = (article: Article): number =>
	article.products.reduce((total, product) => total + product.links.length, 0);

/** The retailers an article links to, each once, in the order they first appear. */
export const retailersUsed = (article: Article): string[] => [
	...new Set(
		article.products.flatMap((product) =>
			product.links.flatMap((link) => (link.retailer ? [link.retailer] : [])),
		),
	),
];
