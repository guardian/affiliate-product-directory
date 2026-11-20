import { z } from 'zod';

const LinkElementSchema = z.object({
	type: z.string(),
	// Only link elements have this. Product buttons have the linkType 'product-button'.
	linkTypeData: z
		.object({
			url: z.string().optional(),
			label: z.string().optional(),
			linkType: z.string().optional(),
		})
		.optional(),
});

// CAPI sends empty strings for the parts of a product card link that haven't been filled in.
const ProductCtaSchema = z.object({
	url: z.string().default(''),
	text: z.string().default(''),
	retailer: z.string().default(''),
	price: z.string().default(''),
});

/** An element of an article's body, with only the fields the tool uses. */
const BlockElementSchema = LinkElementSchema.extend({
	// Only text elements have this.
	textTypeData: z.object({ html: z.string().optional() }).optional(),
	// Only product elements (product cards) have this.
	productTypeData: z
		.object({
			productName: z.string().optional(),
			brandName: z.string().optional(),
			productCtas: z.array(ProductCtaSchema).optional(),
			// The elements shown inside the card, which can include product buttons.
			content: z.array(LinkElementSchema).optional(),
		})
		.optional(),
});

export const BlockSchema = z.object({
	elements: z.array(BlockElementSchema).optional(),
});

export type LinkElement = z.infer<typeof LinkElementSchema>;
export type ProductCta = z.infer<typeof ProductCtaSchema>;
export type BlockElement = z.infer<typeof BlockElementSchema>;
export type Block = z.infer<typeof BlockSchema>;
