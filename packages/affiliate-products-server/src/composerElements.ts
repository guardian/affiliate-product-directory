import { z } from 'zod';
import type { Block, BlockElement, LinkElement, ProductCta } from './types';

/*
 * GUESSED: how Composer holds the elements that products are in. These follow
 * flexible-model (an elementType with string fields) but haven't been checked against a
 * real message from Composer. When the sample arrives, fix them here and in
 * @mocks/ComposerContentFixture, and nowhere else.
 */
const composerFieldNames = {
	text: { html: 'text' },
	link: { url: 'url', label: 'label', linkType: 'linkType' },
	product: {
		productName: 'productName',
		brandName: 'brandName',
		ctas: 'productCtas',
		content: 'content',
	},
} as const;

// Composer may write a product button's link type in either case.
const isProductButtonType = (linkType: string | undefined) =>
	linkType !== undefined && /^product[-_]?button$/i.test(linkType);

const ComposerElementSchema = z.object({
	// flexible-model calls it elementType, and CAPI calls it type.
	elementType: z.string().optional(),
	type: z.string().optional(),
	fields: z.record(z.string(), z.unknown()).default({}),
});

type ComposerElement = z.infer<typeof ComposerElementSchema>;

const stringField = (fields: Record<string, unknown>, name: string) => {
	const value = fields[name];
	return typeof value === 'string' ? value : undefined;
};

/** A field that's a list, or the same list written as JSON, as flexible-model's fields are strings. */
const listField = (
	fields: Record<string, unknown>,
	name: string,
): unknown[] => {
	const value = fields[name];
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value === 'string') {
		try {
			const parsed: unknown = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
};

const CtaSchema = z.object({
	url: z.string().catch(''),
	text: z.string().catch(''),
	retailer: z.string().catch(''),
	price: z.string().catch(''),
});

const linkElement = (fields: Record<string, unknown>): LinkElement => {
	const names = composerFieldNames.link;
	const linkType = stringField(fields, names.linkType);
	return {
		type: 'link',
		linkTypeData: {
			url: stringField(fields, names.url),
			label: stringField(fields, names.label),
			linkType: isProductButtonType(linkType) ? 'product-button' : linkType,
		},
	};
};

const parseElement = (raw: unknown): ComposerElement | undefined => {
	const element = ComposerElementSchema.safeParse(raw);
	return element.success ? element.data : undefined;
};

const productElement = (fields: Record<string, unknown>): BlockElement => {
	const names = composerFieldNames.product;
	const productCtas: ProductCta[] = listField(fields, names.ctas).flatMap(
		(cta) => {
			const parsed = CtaSchema.safeParse(cta);
			return parsed.success ? [parsed.data] : [];
		},
	);
	// The elements shown inside the card. Only its product buttons matter.
	const content = listField(fields, names.content).flatMap((raw) => {
		const element = parseElement(raw);
		return element && (element.elementType ?? element.type) === 'link'
			? [linkElement(element.fields)]
			: [];
	});
	return {
		type: 'product',
		productTypeData: {
			productName: stringField(fields, names.productName),
			brandName: stringField(fields, names.brandName),
			productCtas,
			content,
		},
	};
};

const toBlockElement = (raw: unknown): BlockElement | undefined => {
	const element = parseElement(raw);
	if (!element) {
		return undefined;
	}
	switch (element.elementType ?? element.type) {
		case 'text':
			return {
				type: 'text',
				textTypeData: {
					html: stringField(element.fields, composerFieldNames.text.html),
				},
			};
		case 'link':
			return linkElement(element.fields);
		case 'product':
			return productElement(element.fields);
		default:
			// Kept, so a product isn't named by text from before an image or embed.
			return { type: element.elementType ?? element.type ?? 'unknown' };
	}
};

/**
 * Composer's body elements as the CAPI body that extractProducts reads. Elements it
 * can't read are left out rather than failing, as Composer's model will change.
 */
export const composerElementsToBlocks = (elements: unknown[]): Block[] => [
	{
		elements: elements.flatMap((raw) => {
			const element = toBlockElement(raw);
			return element ? [element] : [];
		}),
	},
];
