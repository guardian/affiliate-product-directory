// The articles that frontend shows live prices in by their path, until it reads CAPI's
// livePricingEnabled field instead. A copy of the allowList in frontend's
// common/app/model/AffiliateProductLivePricing.scala: keep the two the same, until
// https://github.com/guardian/frontend/pull/29333 removes it, and then remove this.

/** Each stage's articles with live pricing, by CAPI ID, which is the path without its leading slash. */
const livePricingAllowList: Record<string, readonly string[] | undefined> = {
	CODE: [
		'thefilter/2025/nov/15/best-christmas-gifts-ideas-filter-uk-2025',
		'thefilter/2026/oct/15/i-love-bass-bass-bass-and-bass-dj-paulette-carl-craig-and-more-on-the-best-dj-headphones',
	],
	PROD: [
		'thefilter/2025/feb/20/best-dj-headphones',
		'thefilter/2025/oct/24/tips-to-make-mornings-better',
		'thefilter/2025/apr/18/best-pressure-washers-cleaners-uk',
		'thefilter/2025/jul/04/best-cool-boxes-bags-uk',
		'thefilter-us/2026/apr/23/what-readers-bought-april',
		'thefilter-us/2026/jun/20/summer-running-gear-essentials',
	],
};

/** The CAPI IDs of the articles frontend shows live prices in for a stage, as frontend picks its list. */
export const livePricingAllowListIds = (stage: string): Set<string> =>
	new Set(livePricingAllowList[stage === 'PROD' ? 'PROD' : 'CODE'] ?? []);
