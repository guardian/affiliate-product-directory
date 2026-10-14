import type { AttributeValue } from '@aws-sdk/client-dynamodb';

export type Region = 'GB' | 'US';
export interface Product {
	productMerchantUrl: string;
	createdAt: number;
	region: Region;
	updatedAt: number;
	updatedBy: string;
	removed?: string;
	removedAt?: number;
	price: number;
	currency: string;
	expiresAt?: number;
}

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

export function getArticleProductFromDynamoRecord(
	raw: Record<string, AttributeValue>,
): DirectoryArticleProductTableEntry {
	return {
		productMerchantUrl: raw['productMerchantUrl']?.S ?? '',
		articleUrl: raw['articleUrl']?.S ?? '',
		composerArticleId: raw['composerArticleId']?.S,
		removed: raw['removed']?.S === 'true',
	};
}

export function getPriceProductFromDynamoRecord(
	raw: Record<string, AttributeValue>,
): Product {
	return {
		productMerchantUrl: raw['productMerchantUrl']?.S ?? '',
		createdAt: Number(raw['createdAt']?.N ?? 0),
		region: (raw['region']?.S ?? 'GB') as Region,
		updatedAt: Number(raw['updatedAt']?.N ?? 0),
		updatedBy: raw['updatedBy']?.S ?? '',
		...(raw['removed']?.S === undefined ? {} : { removed: raw['removed'].S }),
		...(raw['removedAt']?.N === undefined
			? {}
			: { removedAt: Number(raw['removedAt'].N) }),
		price: Number(raw['price']?.N ?? 0),
		currency: raw['currency']?.S ?? '',
	};
}
