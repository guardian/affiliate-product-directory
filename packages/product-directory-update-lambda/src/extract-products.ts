import type { Block } from '@guardian/content-api-models/v1/block';
import type { Blocks } from '@guardian/content-api-models/v1/blocks';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { ElementType } from '@guardian/content-api-models/v1/elementType';
import { LinkType } from '@guardian/content-api-models/v1/linkType';

export function extractAllProductsFromArticle(content: Content) {
	if (content.type == ContentType.ARTICLE && content.blocks) {
		const articleBlocks: Blocks = content.blocks;
		// TODO: why did recipes-backend check the main block?

		const bodyBlocks = articleBlocks.body as Block[];
		const bodyBlockProductElements = bodyBlocks.flatMap((bodyBlock) =>
			extractProductElements(content, bodyBlock),
		);
		const bodyProductButtons = bodyBlocks.flatMap((bodyBlock) =>
			extractProductButtons(content, bodyBlock),
		);
		//ToDo: get the nested product buttons from the product element main content

		return [];
	} else {
		return [];
	}
}

export function extractProductElements(content: Content, block: Block) {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- to fix error when elements are undefined , example if main block does not have any elements.
	if (!block?.elements) {
		return [];
	} else {
		return block.elements.filter((elem) => elem.type === ElementType.PRODUCT);
	}
}

export function extractProductButtons(content: Content, block: Block) {
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
