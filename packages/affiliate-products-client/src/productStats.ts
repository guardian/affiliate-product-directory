import type { Article, ProductLink } from '@common/tool-models';
import { currencyOfSymbol } from './currency';

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

/** How far a Current price can be from the price written in the article before it's flagged. */
export const priceGapThreshold = 0.3;

/**
 * How far a link's Current price is from the price written in the article, as a fraction
 * of it: 0.31 for 31% higher, -0.66 for 66% lower. Undefined when either is missing, or
 * they're in different currencies.
 */
export const priceDifference = ({
	basePrice,
	currency,
	price,
}: ProductLink): number | undefined => {
	if (
		!basePrice ||
		basePrice.amount <= 0 ||
		price === undefined ||
		currency === undefined ||
		currencyOfSymbol(basePrice.currencySymbol) !== currency
	) {
		return undefined;
	}
	return (price - basePrice.amount) / basePrice.amount;
};

// Prices such as £99 and £128.70 are exactly 30% apart, but their difference in floating
// point is a little under 0.3, so it's compared with this much room.
const tolerance = 1e-9;

/** Whether a link's Current price is far enough from the article's to be checked. */
export const hasPriceGap = (link: ProductLink): boolean =>
	Math.abs(priceDifference(link) ?? 0) >= priceGapThreshold - tolerance;

/** How many of an article's links have a Current price far from the article's. */
export const priceGapCount = (article: Article): number =>
	article.products.flatMap(({ links }) => links).filter(hasPriceGap).length;
