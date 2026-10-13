export const appName = 'affiliate-product-directory';

/**
 * Where the price update Lambda writes the active products in the pricing table, in the
 * bucket it's given. The affiliate products tool reads its prices from here.
 */
export const getCachedProductPricesKey = (stage: string) =>
	`${stage}/affiliates/cached-product-prices.json`;
