// These mirror dotcom-rendering's livePriceUtils (src/components/AffiliateProducts), so the
// tool reads a price from a link's label the same way the site does. Keep the two in step.

import type { ProductCta } from './articleBody';

/** A price found in a link's label. */
export interface ExtractedPrice {
	entireMatch: string;
	numericPrice: number;
	currencySymbol: string;
	priceAsString: string;
}

export const getProductLinkLabelWithPrice = (cta: ProductCta): string => {
	const overrideLabel = cta.text.trim().length > 0;
	return overrideLabel ? cta.text : `${cta.price} at ${cta.retailer}`;
};

const priceRegex = /([£$])(\d+,?\d*(\.\d{2})?)/;
export const extractPriceFromLabel = (
	label: string,
): ExtractedPrice | undefined => {
	const [entireMatch, currencySymbol, price] = label.match(priceRegex) ?? [];

	if (
		entireMatch === undefined ||
		currencySymbol === undefined ||
		price === undefined
	) {
		return undefined;
	}

	return {
		entireMatch,
		numericPrice: Number.parseFloat(price.replace(/,/g, '')),
		currencySymbol,
		priceAsString: price,
	};
};
