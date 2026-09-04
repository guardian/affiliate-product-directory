export type DirectoryPricingTableEntry = {
	productMerchantUrl: string;
	region: string;
};

export type DirectoryArticleProductTableEntry = {
	productMerchantUrl: string;
	articleUrl: string;
	composerArticleId?: string;
};

export type ExtractedDirectoryProduct = {
	pricing: DirectoryPricingTableEntry;
	article: DirectoryArticleProductTableEntry;
};
