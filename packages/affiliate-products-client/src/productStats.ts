import type { Article } from '@common/tool-models';

/** How many links an article has to its products' retailers. */
export const retailerLinkCount = (article: Article): number =>
	article.products.reduce((total, product) => total + product.links.length, 0);

export interface RetailerUsed {
	retailer: string;
	links: number;
	/** Whether any of its links go through Skimlinks. */
	skimlinks: boolean;
}

/** The retailers an article links to, each with how many links it has, most first, then A–Z. */
export const retailersUsed = (article: Article): RetailerUsed[] => {
	const retailers = new Map<string, RetailerUsed>();
	for (const { retailer, kind } of article.products.flatMap(
		({ links }) => links,
	)) {
		if (retailer) {
			const used = retailers.get(retailer) ?? {
				retailer,
				links: 0,
				skimlinks: false,
			};
			retailers.set(retailer, {
				...used,
				links: used.links + 1,
				skimlinks: used.skimlinks || kind === 'skimlinks',
			});
		}
	}
	return [...retailers.values()].sort(
		(a, b) => b.links - a.links || a.retailer.localeCompare(b.retailer),
	);
};
