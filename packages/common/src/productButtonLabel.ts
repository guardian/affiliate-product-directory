// How the site shows a product button's label with the directory's latest price, so the
// affiliate tool can preview it. A copy of dotcom-rendering's rewriteLabelWithLatestPrice
// and shouldPutOldPriceInStrikethrough, in
// dotcom-rendering/src/components/AffiliateProducts/livePriceUtils.tsx: keep the two the same.
// Shared by the tool's client and its tests, so it should only use the platform.

/** A button's label as the site shows it: an old price struck through, then the rest. */
export interface ProductButtonLabel {
	struckThrough?: string;
	text: string;
}

const currencySymbols: Record<string, string | undefined> = {
	GBP: '£',
	USD: '$',
};

const priceRegex = /([£$])(\d+,?\d*(\.\d{2})?)/;

// The conventional label, "{price} at {retailer}". The site leaves any other label alone.
const priceAtRetailerRegex = new RegExp(`^${priceRegex.source} at .+$`);

const priceFormatter = new Intl.NumberFormat('en-GB', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const formatPrice = (price: number): string =>
	priceFormatter.format(price).replace(/\.00$/, '');

/**
 * The site always replaces a price that has gone up. It only strikes the old price through
 * when the latest is at least 10% and at least £5 or $5 lower.
 */
export const shouldPutOldPriceInStrikethrough = (
	latestPrice: number,
	articlePrice: number,
) => latestPrice <= articlePrice * 0.9 && articlePrice - latestPrice >= 5;

/**
 * A product button's label as the site shows it, given the directory's latest price for
 * its URL. The label is left as it is when there's no latest price, when the label isn't
 * "{price} at {retailer}", or when the latest price is in another currency.
 */
export const productButtonLabel = (
	label: string,
	latest: { currency?: string; price?: number },
): ProductButtonLabel => {
	const symbol =
		latest.currency === undefined
			? undefined
			: currencySymbols[latest.currency];
	const match = priceRegex.exec(label);
	if (
		symbol === undefined ||
		latest.price === undefined ||
		!priceAtRetailerRegex.test(label) ||
		!match
	) {
		return { text: label };
	}
	const [entireMatch, currencySymbol, amount = ''] = match;
	const articlePrice = Number.parseFloat(amount.replace(/,/g, ''));
	if (currencySymbol !== symbol || Number.isNaN(articlePrice)) {
		return { text: label };
	}

	const latestPrice = `${symbol}${formatPrice(latest.price)}`;
	if (shouldPutOldPriceInStrikethrough(latest.price, articlePrice)) {
		return {
			struckThrough: entireMatch,
			text: ` ${label.replace(entireMatch, latestPrice)}`,
		};
	}
	return { text: label.replace(entireMatch, latestPrice) };
};
