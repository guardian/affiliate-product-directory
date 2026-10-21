import type { Product, ProductLink } from '@common/tool-models';
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

// A product button's label ends with its retailer, as in "£27 at Cult Beauty" or "£2.20
// for 580g at Morrisons (38p/100g)".
const retailerInLabel = /\bat\s+([^()]+?)\s*(?:\(.*\))?\s*$/i;

const productButtonLink = (button: LinkElement): ProductLink => {
	const { url = '', label = '' } = button.linkTypeData ?? {};
	return {
		url,
		label,
		retailer: retailerInLabel.exec(label)?.[1],
		basePrice: findBasePrice(label),
	};
};

/** A product card, with its own links, then the product buttons shown inside it. */
const productCard = (card: BlockElement): Product | undefined => {
	const product = card.productTypeData;
	if (!product) {
		return undefined;
	}

	const name =
		[product.brandName, product.productName]
			.map((part) => part?.trim() ?? '')
			.filter((part) => part !== '')
			.join(' ') || undefined;

	const cardLinks = (product.productCtas ?? []).map((cta) => {
		const label = getProductLinkLabelWithPrice(cta);
		return {
			url: cta.url,
			label,
			retailer: cta.retailer.trim() || undefined,
			// The price field first, so that a label written by hand doesn't hide it.
			basePrice: findBasePrice(cta.price, label),
		};
	});

	const buttonLinks = (product.content ?? [])
		.filter(isProductButton)
		.map(productButtonLink);

	return { name, links: [...cardLinks, ...buttonLinks] };
};

const decodeEntities = (text: string) =>
	text
		.replace(/&nbsp;/g, ' ')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

// Line breaks become spaces, but other tags are removed, as names are sometimes split
// across several tags, as in "<strong>Pasta</strong><strong> maker</strong>". Any angle
// brackets left once the entities are decoded are removed too, so no HTML is left.
const plainText = (html: string) =>
	decodeEntities(html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''))
		.replace(/[<>]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\s+([:,.])/g, '$1')
		.trim();

/** A heading's or list item's name, without the label before it, as in "Best for travel: X". */
const withoutLabel = (text: string) => {
	const colon = text.indexOf(':');
	const name = colon === -1 ? text : text.slice(colon + 1).trim();
	return name === '' ? text : name;
};

// The ways articles name the product whose buttons come straight after, at the end of a
// text element: a paragraph of bold text, as in buying guides; a heading, as in reviews;
// and an "at a glance" list item, "<strong>Best for travel:</strong><br>Product".
const endingBoldParagraph = /<p>\s*((?:<strong>[^<]*<\/strong>\s*)+)<\/p>\s*$/;
const endingHeading = /<h[23]>((?:(?!<h[23]).)*)<\/h[23]>\s*$/s;
const endingListItem = /<li>((?:(?!<li>).)*)<\/li>\s*<\/ul>\s*$/s;

/** The name of the product a text element ends by naming, if it does. */
const endingProductName = (html: string): string | undefined => {
	const bold = endingBoldParagraph.exec(html)?.[1];
	if (bold !== undefined) {
		return plainText(bold) || undefined;
	}
	const heading =
		endingHeading.exec(html)?.[1] ?? endingListItem.exec(html)?.[1];
	if (heading !== undefined) {
		const name = withoutLabel(plainText(heading));
		// Section breaks are written as headings of asterisks.
		return /^[*\s]*$/.test(name) ? undefined : name;
	}
	return undefined;
};

// The Guardian's sites, on PROD and CODE.
const guardianHost =
	/(^|\.)theguardian\.com$|(^|\.)code\.dev-theguardian\.com$/;

// The Filter's fronts, such as /us/thefilter, and its articles, such as /thefilter/2026/….
const filterPath = /^\/((uk|us)\/)?thefilter(-us)?(\/|$)/;

/**
 * Whether a link goes back to the Filter, as some product buttons do, such as "Explore
 * the Filter", rather than to a product.
 */
const isFilterLink = (url: string) => {
	try {
		const { hostname, pathname } = new URL(url);
		return guardianHost.test(hostname) && filterPath.test(pathname);
	} catch {
		return false;
	}
};

interface FoundProduct extends Product {
	fromCard: boolean;
}

/** Gives a product another's name, if it has none or the other's is a product card's. */
const adoptName = (product: FoundProduct, other: FoundProduct) => {
	if (other.name && (!product.name || (other.fromCard && !product.fromCard))) {
		product.name = other.name;
	}
	product.fromCard ||= other.fromCard;
};

/**
 * Combines products that share a URL into the first of them, as an article often lists a
 * product twice: in an "at a glance" list, then in full, sometimes with more retailers.
 * A product that shares URLs with several earlier ones joins them all into the first.
 * A product card's name is preferred, then the first name found.
 */
const mergeByUrl = (found: FoundProduct[]): Product[] => {
	let merged: FoundProduct[] = [];
	const productByUrl = new Map<string, FoundProduct>();

	for (const product of found) {
		const links = product.links.filter(
			({ url }) => url.trim() !== '' && !isFilterLink(url),
		);
		// The products already found with any of these links, in the order they appear.
		const matches = merged.filter((earlier) =>
			links.some(({ url }) => productByUrl.get(url) === earlier),
		);
		const [target = { ...product, links: [] }, ...others] = matches;
		if (matches.length === 0) {
			merged.push(target);
		} else {
			for (const other of others) {
				adoptName(target, other);
				for (const link of other.links) {
					productByUrl.set(link.url, target);
					target.links.push(link);
				}
			}
			merged = merged.filter((earlier) => !others.includes(earlier));
			adoptName(target, product);
		}
		for (const link of links) {
			if (!productByUrl.has(link.url)) {
				productByUrl.set(link.url, target);
				target.links.push(link);
			}
		}
	}

	return merged
		.filter((product) => product.links.length > 0)
		.map(({ name, links }) => ({ name, links }));
};

/**
 * The products in an article's body, in the order they appear, each with its links to
 * the retailers that sell it.
 *
 * A product card is one product. Product buttons outside a card are grouped by run: the
 * buttons in a row are one product, at different retailers. A run is named by the text
 * just before it, if that ends with a product's name.
 *
 * Each URL is listed once, as the directory keys products by URL. Products that share a
 * URL are one product, listed where it first appears.
 */
export const extractProducts = (bodyBlocks: Block[]): Product[] => {
	const found: FoundProduct[] = [];
	// The name the next run of product buttons takes, from the element just before it.
	let nextName: string | undefined;
	// The run of product buttons being read, if the last element was a product button.
	let run: FoundProduct | undefined;

	for (const element of bodyBlocks.flatMap((block) => block.elements ?? [])) {
		if (isProductButton(element)) {
			if (!run) {
				run = { name: nextName, links: [], fromCard: false };
				found.push(run);
			}
			run.links.push(productButtonLink(element));
			nextName = undefined;
			continue;
		}

		// Composer sometimes leaves empty text between a product's buttons.
		if (
			element.type === 'text' &&
			plainText(element.textTypeData?.html ?? '') === ''
		) {
			continue;
		}

		run = undefined;
		nextName =
			element.type === 'text'
				? endingProductName(element.textTypeData?.html ?? '')
				: undefined;
		if (element.type === 'product') {
			const card = productCard(element);
			if (card) {
				found.push({ ...card, fromCard: true });
			}
		}
	}

	return mergeByUrl(found);
};
