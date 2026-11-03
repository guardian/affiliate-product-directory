import type { Region } from '@common/models';

/** The only currency a product in each region may be priced in. */
export const REGION_CURRENCY: Record<Region, string> = { GB: 'GBP', US: 'USD' };

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
