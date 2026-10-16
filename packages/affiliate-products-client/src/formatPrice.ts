// This mirrors formatPrice in dotcom-rendering's livePriceUtils (src/components/AffiliateProducts),
// so the tool shows a price the same way the site does. Keep the two in step.

const priceFormatter = new Intl.NumberFormat('en-GB', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const formatPrice = (price: number): string =>
	priceFormatter.format(price).replace(/\.00$/, '');
