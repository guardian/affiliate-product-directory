import type { DynamoService } from './database-service';

type ProductToRemove = {
	url: string;
	shouldRemoveFromPricingTable: boolean;
};

export async function markProductsAsRemovedFromArticle(
	removedProductUrls: string[],
	articleUrl: string,
	dynamoService: DynamoService,
): Promise<void> {
	// Determine if it needs to be marked removed in the pricing table
	const productsToRemove = await Promise.all(
		removedProductUrls.map(async (removedProductMerchantUrl) => {
			const productArticles = await dynamoService.getArticlesForProduct(
				removedProductMerchantUrl,
			);
			return {
				url: removedProductMerchantUrl,
				shouldRemoveFromPricingTable: productArticles.length <= 1,
			};
		}),
	);
	await Promise.all(
		productsToRemove.map((productToRemove) =>
			markProductAsRemoved(productToRemove, articleUrl, dynamoService),
		),
	);
}

async function markProductAsRemoved(
	productToRemove: ProductToRemove,
	articleUrl: string,
	dynamoService: DynamoService,
): Promise<void> {
	await Promise.all([
		dynamoService.markProductAsRemovedInArticle(
			productToRemove.url,
			articleUrl,
		),
		productToRemove.shouldRemoveFromPricingTable
			? dynamoService.markPricingProductAsRemoved(productToRemove.url)
			: Promise.resolve(),
	]);
}

/**
 * Given an article - mark as removed any products featured in it
 * 	@param articleUrl the url of the article that was taken down
 */
export async function handleTakedown(
	articleUrl: string,
	dynamoService: DynamoService,
): Promise<number> {
	const products = await dynamoService.getProductsInArticle(articleUrl);

	await markProductsAsRemovedFromArticle(products, articleUrl, dynamoService);

	return products.length;
}
