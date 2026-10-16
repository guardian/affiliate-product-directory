import type { ProductLink } from '@common/tool-models';
import { extractPriceFromLabel, getProductLinkLabelWithPrice } from './price';
import type { Block, BlockElement, LinkElement } from './types';

const isProductButton = (element: LinkElement) =>
	element.type === 'link' &&
	element.linkTypeData?.linkType === 'product-button';

/** The first price found in the given texts, in the shape sent to the client. */
const findBasePrice = (...texts: string[]): ProductLink['basePrice'] => {
	for (const text of texts) {
		const price = extractPriceFromLabel(text);
		if (price) {
			return {
				currencySymbol: price.currencySymbol,
				amount: price.numericPrice,
			};
		}
	}
	return undefined;
};

const productButtonLink = (
	button: LinkElement,
	productName?: string,
): ProductLink => {
	const { url = '', label = '' } = button.linkTypeData ?? {};
	return { url, label, productName, basePrice: findBasePrice(label) };
};

/** A product card's own links, then the product buttons shown inside it. */
const productCardLinks = (card: BlockElement): ProductLink[] => {
	const product = card.productTypeData;
	if (!product) {
		return [];
	}

	const productName =
		[product.brandName, product.productName]
			.filter((part) => part !== undefined && part.trim() !== '')
			.join(' ') || undefined;

	const cardLinks = (product.productCtas ?? []).map((cta) => {
		const label = getProductLinkLabelWithPrice(cta);
		return {
			url: cta.url,
			label,
			productName,
			// The price field first, so that a label written by hand doesn't hide it.
			basePrice: findBasePrice(cta.price, label),
		};
	});

	const buttonLinks = (product.content ?? [])
		.filter(isProductButton)
		.map((button) => productButtonLink(button, productName));

	return [...cardLinks, ...buttonLinks];
};

/**
 * The product links in an article's body, in the order they appear: product buttons and
 * the links on product cards. Each URL is listed once, as the directory keys products by
 * URL and a product card usually repeats its links as buttons.
 */
export const extractProductLinks = (bodyBlocks: Block[]): ProductLink[] => {
	const links = bodyBlocks
		.flatMap((block) => block.elements ?? [])
		.flatMap((element) => {
			if (isProductButton(element)) {
				return [productButtonLink(element)];
			}
			return element.type === 'product' ? productCardLinks(element) : [];
		});

	const seenUrls = new Set<string>();
	return links.filter(({ url }) => {
		if (url.trim() === '' || seenUrls.has(url)) {
			return false;
		}
		seenUrls.add(url);
		return true;
	});
};
