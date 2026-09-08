import { jest } from '@jest/globals';
import type { Product } from '@common/models';

const mockGetAllProducts =
	jest.fn<
		(args: { lastEvaluatedKey?: Record<string, unknown> }) => Promise<unknown[]>
	>();
const mockBatchUpdateProducts =
	jest.fn<(args: { items: Product[] }) => Promise<void>>();
const mockSaveProduct = jest.fn<(product: unknown) => Promise<void>>();
const mockGetProductsInArticle =
	jest.fn<(articleUrl: string) => Promise<string[]>>();
const mockGetArticlesForProduct =
	jest.fn<(productMerchantUrl: string) => Promise<string[]>>();
const mockMarkPricingProductAsRemoved =
	jest.fn<(productMerchantUrl: string) => Promise<void>>();
const mockMarkProductAsRemovedInArticle =
	jest.fn<(productMerchantUrl: string, articleUrl: string) => Promise<void>>();

jest.unstable_mockModule('@common/database-service', () => ({
	DynamoService: jest.fn(() => ({
		getAllProducts: mockGetAllProducts,
		batchUpdateProducts: mockBatchUpdateProducts,
		saveProduct: mockSaveProduct,
		getProductsInArticle: mockGetProductsInArticle,
		getArticlesForProduct: mockGetArticlesForProduct,
		markPricingProductAsRemoved: mockMarkPricingProductAsRemoved,
		markProductAsRemovedInArticle: mockMarkProductAsRemovedInArticle,
	})),
}));

export {
	mockGetAllProducts,
	mockBatchUpdateProducts,
	mockSaveProduct,
	mockGetProductsInArticle,
	mockGetArticlesForProduct,
	mockMarkPricingProductAsRemoved,
	mockMarkProductAsRemovedInArticle,
};
