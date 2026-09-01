import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { extractAllProductsFromArticle } from './extract-products';
import { isFilterArticleByTags } from './utils';

export function handleContentUpdate({ content }: { content: Content }): number {
	try {
		if (content.type != ContentType.ARTICLE) {
			return 0;
		} //no point processing live-blogs etc.

		if (!isFilterArticleByTags(content.tags)) {
			return 0;
		}

		const productsFound = extractAllProductsFromArticle(content);
		console.log(`to be implemented ${productsFound.length}`);
		return productsFound.length;
		// ToDo: process the products
	} catch (err) {
		//log out what actually caused the breakage
		console.error('Failed article was: ', JSON.stringify(content), err);
		throw err;
	}
}
