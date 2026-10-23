import { SectionSchema } from '@common/tool-models';

/** The currencies a price can be set in by hand. */
export const currencies = ['GBP', 'USD', 'EUR'] as const;

export type Currency = (typeof currencies)[number];

export const isCurrency = (value: unknown): value is Currency =>
	currencies.some((currency) => currency === value);

export const currencySymbols: Record<Currency, string> = {
	GBP: '£',
	USD: '$',
	EUR: '€',
};

/** A price in its currency, such as £24.99, or with its code for any other currency. */
export const currencySymbol = (currency: string) =>
	isCurrency(currency) ? currencySymbols[currency] : `${currency} `;

/** The currency a price written with this symbol is in. */
export const currencyOfSymbol = (symbol: string): Currency | undefined =>
	currencies.find((currency) => currencySymbols[currency] === symbol);

/** A currency a section's articles are priced in. */
export type SectionCurrency = Exclude<Currency, 'EUR'>;

/** The currency each section's articles are priced in. */
export const sectionCurrency = (
	sectionId: string,
): SectionCurrency | undefined => {
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

/**
 * A price as typed or pasted, such as "£1,299.00", without its currency sign or code,
 * commas and spaces, so it can be read as a number. Says what was taken out, and the
 * currency its sign or code was for.
 */
export const cleanPrice = (
	text: string,
): { value: string; removed?: string; currency?: Currency } => {
	const sign = /[£$€]/.exec(text)?.[0];
	const code = /\b(GBP|USD|EUR)\b/i.exec(text)?.[1]?.toUpperCase();
	const commas = (text.match(/,/g) ?? []).length;
	const value = text
		.replace(/[£$€]/g, '')
		.replace(/\b(GBP|USD|EUR)\b/gi, '')
		.replace(/[,\s]/g, '');

	const removed = [
		...(sign ? [sign] : []),
		...(code ? [code] : []),
		...(commas === 1 ? ['the comma'] : commas > 1 ? ['the commas'] : []),
	];
	return {
		value,
		removed:
			removed.length > 0 || value !== text.trim()
				? `Removed ${join(removed.length > 0 ? removed : ['the spaces'])}`
				: undefined,
		currency: sign
			? currencyOfSymbol(sign)
			: isCurrency(code)
				? code
				: undefined,
	};
};
