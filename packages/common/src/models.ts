import type { AttributeValue } from '@aws-sdk/client-dynamodb';

export type Region = 'GB' | 'US';
export interface Product {
	productMerchantUrl: string;
	region: Region;
	updatedAt?: number;
	updatedBy?: string;
	removed?: string;
	removedAt?: number;
	// Both are missing until a price provider has priced the product.
	price?: number;
	currency?: string;
	expiresAt?: number;
}

export type ArticleProduct = {
	productMerchantUrl: string;
	articleUrl: string;
	composerArticleId?: string;
	removed?: boolean;
};

export type ExtractedDirectoryProduct = {
	pricing: Product;
	article: ArticleProduct;
};

export function getArticleProductFromDynamoRecord(
	raw: Record<string, AttributeValue>,
): ArticleProduct {
	return {
		productMerchantUrl: raw['productMerchantUrl']?.S ?? '',
		articleUrl: raw['articleUrl']?.S ?? '',
		composerArticleId: raw['composerArticleId']?.S,
		removed: raw['removed']?.S === 'true',
	};
}

/** A product that a price provider has priced, in the latest run or an earlier one. */
export type PricedProduct = Product & { price: number; currency: string };
