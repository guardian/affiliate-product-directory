import type { AttributeValue } from '@aws-sdk/client-dynamodb';

export type DirectoryPricingTableEntry = {
	productMerchantUrl: string;
	region: string;
	removed?: boolean;
};

export type DirectoryArticleProductTableEntry = {
	productMerchantUrl: string;
	articleUrl: string;
	composerArticleId?: string;
	removed?: boolean;
};

export type ExtractedDirectoryProduct = {
	pricing: DirectoryPricingTableEntry;
	article: DirectoryArticleProductTableEntry;
};

export function getDirectoryArticleFromDynamoRecord(
	raw: Record<string, AttributeValue>,
): DirectoryArticleProductTableEntry {
	return {
		productMerchantUrl: raw['productMerchantUrl']?.S ?? '',
		articleUrl: raw['articleUrl']?.S ?? '',
		composerArticleId: raw['composerArticleId']?.S,
	};
}
