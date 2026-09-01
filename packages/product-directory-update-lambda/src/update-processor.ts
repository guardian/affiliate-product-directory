import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { DynamoService } from './database-service';
import { extractAllProductsFromArticle } from './extract-products';
import { isFilterArticleByTags } from './utils';

export async function handleContentUpdate({
	content,
	dynamoService,
}: {
	content: Content;
	dynamoService: DynamoService;
}): Promise<void> {
	try {
		if (content.type != ContentType.ARTICLE) {
			return;
		} //no point processing live-blogs etc.

		if (!isFilterArticleByTags(content.tags)) {
			return;
		}

		const productsFound = extractAllProductsFromArticle(content);
		await Promise.all(productsFound.map((product) => dynamoService.saveProduct(product)));
	} catch (err) {
		//log out what actually caused the breakage
		console.error('Failed article was: ', JSON.stringify(content), err);
		throw err;
	}
}
