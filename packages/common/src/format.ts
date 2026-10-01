export function getCurrencySymbol(currency: string) {
	switch (currency) {
		case 'USD':
			return '$';
		case 'GBP':
			return '£';
		default:
			throw new Error('Missing currency mapping');
	}
}

/*
    Format the price for display
    Use two decimal places or none
*/
export function formatPrice(price: number) {
	const formatted = price.toFixed(2);
	return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
}
