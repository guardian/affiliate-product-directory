import type { Block } from '@guardian/content-api-models/v1/block';
import type { BlockElement } from '@guardian/content-api-models/v1/blockElement';
import type { Blocks } from '@guardian/content-api-models/v1/blocks';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { ElementType } from '@guardian/content-api-models/v1/elementType';
import { LinkType } from '@guardian/content-api-models/v1/linkType';
import type { ProductCTA } from '@guardian/content-api-models/v1/productCTA';
import type { DirectoryProduct } from './models';

export function extractAllProductsFromArticle(
	content: Content,
): DirectoryProduct[] {
	if (content.type == ContentType.ARTICLE && content.blocks) {
		const articleBlocks: Blocks = content.blocks;
		// TODO: why did recipes-backend check the main block?

		const bodyBlocks = articleBlocks.body as Block[];

		const bodyBlockProductElements = bodyBlocks.flatMap((bodyBlock) =>
			extractProductElements(bodyBlock),
		);

		const bodyProductButtons = bodyBlocks.flatMap((bodyBlock) =>
			extractProductButtons(bodyBlock),
		);

		const nestedButtonProductUrls = bodyBlockProductElements
			.flatMap((block) =>
				extractNestedProductButtons(block.productTypeData?.content),
			)
			.map(getProductUrlFromButton);
		const productCTAUrls = bodyBlockProductElements
			.flatMap(getProductCTAsFromProductElement)
			.map(getProductUrlFromProductCTA);
		const buttonProductURLs = bodyProductButtons.map(getProductUrlFromButton);

		const deduplicatedURLs = new Set(
			productCTAUrls
				.concat(buttonProductURLs)
				.concat(nestedButtonProductUrls)
				.filter((url) => url !== undefined),
		);
		return [...deduplicatedURLs].map((url) => ({
			productMerchantUrl: url,
		}));
	} else {
		return [];
	}
}

function getProductUrlFromButton(button: BlockElement): string | undefined {
	return button.linkTypeData?.url;
}

function getProductUrlFromProductCTA(
	productCTA: ProductCTA,
): string | undefined {
	return productCTA.url;
}

function getProductCTAsFromProductElement(
	productElement: BlockElement,
): ProductCTA[] {
	return productElement.productTypeData?.productCtas ?? [];
}

function extractProductElements(block: Block) {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- to fix error when elements are undefined , example if main block does not have any elements.
	if (!block?.elements) {
		return [];
	} else {
		return block.elements.filter((elem) => elem.type === ElementType.PRODUCT);
	}
}

function extractProductButtons(block: Block): BlockElement[] {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- to fix error when elements are undefined , example if main block does not have any elements.
	if (!block?.elements) {
		return [];
	} else {
		return block.elements.filter(
			(elem) =>
				elem.type === ElementType.LINK &&
				elem.linkTypeData?.linkType === LinkType.PRODUCT_BUTTON,
		);
	}
}

function extractNestedProductButtons(
	blockElements: BlockElement[] | undefined,
): BlockElement[] {
	if (blockElements === undefined) {
		return [];
	}
	return blockElements.filter(
		(elem) =>
			elem.type === ElementType.LINK &&
			elem.linkTypeData?.linkType === LinkType.PRODUCT_BUTTON,
	);
}
