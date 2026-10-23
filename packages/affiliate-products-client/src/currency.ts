import { SectionSchema } from '@common/tool-models';

/**
 * The currencies a price can be set in by hand: only those the prices CSV and the site
 * can show, as frontend rewrites only £ and $ prices.
 */
export const currencies = ['GBP', 'USD'] as const;

export type Currency = (typeof currencies)[number];

export const isCurrency = (value: unknown): value is Currency =>
	currencies.some((currency) => currency === value);

export const currencySymbols: Record<Currency, string> = {
	GBP: '£',
	USD: '$',
};

/** A price in its currency, such as £24.99, or with its code for any other currency. */
export const currencySymbol = (currency: string) =>
	isCurrency(currency) ? currencySymbols[currency] : `${currency} `;

/** The currency a price written with this symbol is in. */
export const currencyOfSymbol = (symbol: string): Currency | undefined =>
	currencies.find((currency) => currencySymbols[currency] === symbol);

/** The currency each section's articles are priced in. */
export const sectionCurrency = (sectionId: string): Currency | undefined => {
	const section = SectionSchema.safeParse(sectionId);
	if (!section.success) {
		return undefined;
	}
	return section.data === 'thefilter-us' ? 'USD' : 'GBP';
};

const join = (parts: string[]) =>
	parts.length > 1
		? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
		: (parts[0] ?? '');

const signPattern = /[£$]/;

// A code on its own or beside the digits, as in "GBP 24.99" or "24.99USD", but not inside
// a word.
const codePattern = /(?<![a-z])(GBP|USD)(?![a-z])/i;

// Commas only as thousands separators, as in 1,299 or 12,345.67. Any other comma, as in
// 24,99, is left for the price's validation to reject, rather than read as another amount.
const thousandsPattern = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

/**
 * A price as typed or pasted, such as "£1,299.00", without its currency sign or code,
 * thousands separators and spaces, so it can be read as a number. Says what was taken
 * out, and the currency its sign or code was for.
 */
export const cleanPrice = (
	text: string,
): { value: string; removed?: string; currency?: Currency } => {
	const sign = signPattern.exec(text)?.[0];
	const code = codePattern.exec(text)?.[1]?.toUpperCase();
	const unmarked = text
		.replace(new RegExp(signPattern, 'g'), '')
		.replace(new RegExp(codePattern, 'gi'), '')
		.replace(/\s/g, '');
	const commas = thousandsPattern.test(unmarked)
		? (unmarked.match(/,/g) ?? []).length
		: 0;
	const value = commas > 0 ? unmarked.replace(/,/g, '') : unmarked;

	const removed = [
		...(sign ? [sign] : []),
		...(code ? [code] : []),
		...(commas === 1 ? ['the comma'] : commas > 1 ? ['the commas'] : []),
	];
	const spaces = /\s/.test(text.trim());
	return {
		value,
		removed:
			removed.length > 0
				? `Removed ${join(removed)}`
				: spaces
					? 'Removed the spaces'
					: undefined,
		currency: sign
			? currencyOfSymbol(sign)
			: isCurrency(code)
				? code
				: undefined,
	};
};
