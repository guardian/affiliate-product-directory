import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import type { DynamoService } from './database-service';
import { extractAllProductsFromArticle } from './extract-products';
import { isFilterArticleByTags } from './tag-utils';

export function getRemovedProducts(
	newProducts: string[],
	storedProducts: string[],
) {
	return storedProducts.filter(
		(storedProduct) => !newProducts.includes(storedProduct),
	);
}

async function markProductAsRemoved(
	removedProductUrl: string,
	shouldRemoveFromPricingTable: boolean,
	articleUrl: string,
	dynamoService: DynamoService,
): Promise<void> {
	await Promise.all([
		dynamoService.markProductAsRemovedInArticle(removedProductUrl, articleUrl),
		shouldRemoveFromPricingTable
			? dynamoService.markPricingProductAsRemoved(removedProductUrl)
			: Promise.resolve(),
	]);
}

export async function handleContentUpdate({
	content,
	dynamoService,
}: {
	content: Content;
	dynamoService: DynamoService;
}): Promise<number> {
	try {
		if (content.type != ContentType.ARTICLE) {
			return 0;
		} //no point processing live-blogs etc.

		if (!isFilterArticleByTags(content.tags)) {
			return 0;
		}

		const articleUrl = content.id;
		const productsInContent = extractAllProductsFromArticle(content);

		// Get the products we have stored in DB for this article
		const storedProductsForArticle =
			await dynamoService.getProductsInArticle(articleUrl);
		// Get the products removed from this article
		const removedProducts = getRemovedProducts(
			productsInContent.map((p) => p.article.productMerchantUrl),
			storedProductsForArticle,
		);

		// Determine if it needs to be marked removed in the pricing table
		const productsToMarkRemoved = await Promise.all(
			removedProducts.map(async (removedProductUrl) => {
				const productArticles =
					await dynamoService.getArticlesForProduct(removedProductUrl);
				return {
					removedProductUrl,
					shouldRemoveFromPricingTable: productArticles.length <= 1,
				};
			}),
		);

		await Promise.all([
			...productsInContent.map((product) => dynamoService.saveProduct(product)),
			...productsToMarkRemoved.map(
				({ removedProductUrl, shouldRemoveFromPricingTable }) =>
					markProductAsRemoved(
						removedProductUrl,
						shouldRemoveFromPricingTable,
						articleUrl,
						dynamoService,
					),
			),
		]);
		return productsInContent.length;
	} catch (err) {
		//log out what actually caused the breakage
		console.error('Failed article was: ', JSON.stringify(content), err);
		throw err;
	}
}
