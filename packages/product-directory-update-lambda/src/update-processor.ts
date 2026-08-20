import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { extractAllProductsFromArticle } from './extract-products';

export function handleContentUpdate({ content }: { content: Content }) {
	try {
		if (content.type != ContentType.ARTICLE) {
			return;
		} //no point processing live-blogs etc.

		if (
			content.tags.find((tag) =>
				['The Filter UK (series tag)', 'The Filter US'].includes(
					tag.internalName ?? '',
				),
			)
		) {
			console.log('Found a Filter article');
		}

		const productsFound = extractAllProductsFromArticle(content);
		console.log(`to be implemented ${productsFound.length}`);
		// ToDo: process the products
	} catch (err) {
		//log out what actually caused the breakage
		console.error('Failed article was: ', JSON.stringify(content), err);
		throw err;
	}
}
