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
