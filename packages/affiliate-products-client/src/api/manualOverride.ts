/** The result of changing a manual override: undefined if it worked, or what went wrong. */
export type OverrideResult = { error: string } | undefined;

const sendOverride = async (
	method: 'POST' | 'DELETE',
	body: object,
): Promise<OverrideResult> => {
	const response = await fetch('/api/manualOverride', {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (response.ok) {
		return undefined;
	}
	if (response.status === 401) {
		return {
			error: 'Your login has expired. Reload the page to log in again.',
		};
	}
	if (response.status === 404) {
		return {
			error:
				'The directory doesn’t have this link as a product, so its price can’t be set.',
		};
	}
	return { error: `The price couldn’t be saved (${response.status}).` };
};

/**
 * Sets a product's price by hand. The price providers leave it as it is until the expiry
 * date, if there is one, or until the override is removed.
 */
export const setPriceOverride = (override: {
	productMerchantUrl: string;
	currency: 'GBP' | 'USD';
	price: number;
	// When the price stops being kept, as an ISO instant such as 2026-10-31T23:59:59.999Z.
	expiryDate?: string;
}) => sendOverride('POST', override);

/** Removes a manual override, leaving the product unpriced until a price provider prices it. */
export const removePriceOverride = (productMerchantUrl: string) =>
	sendOverride('DELETE', { productMerchantUrl });
