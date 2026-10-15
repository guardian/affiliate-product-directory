import type * as DatabaseServiceModule from '@common/database-service';
import { jest } from '@jest/globals';
import { mockAmazonRefreshPrices } from '@mocks/AmazonPriceProviderMock';
import {
	mockGetAllProducts,
	mockUpdateProducts,
} from '@mocks/DatabaseServiceMock';
import { buildProduct } from '@mocks/ProductFixtures';
import { mockWriteProductsToS3File } from '@mocks/S3FileWriterMock';
import { mockShopifyRefreshPrices } from '@mocks/ShopifyPriceProviderMock';
import { mockSkimlinksRefreshPrices } from '@mocks/SkimlinksPriceProviderMock';
import '@mocks/S3FileWriterMock';
import type * as ProductsUpdaterModule from './ProductsUpdater';

let ProductsUpdater: typeof ProductsUpdaterModule.ProductsUpdater;
let DynamoService: typeof DatabaseServiceModule.DynamoService;

beforeAll(async () => {
	// Import after the mocks above have registered, otherwise the real
	// modules get pulled in first and the mocks never take effect.
	({ ProductsUpdater } = await import('./ProductsUpdater'));
	({ DynamoService } = await import('@common/database-service'));
});

beforeEach(() => {
	jest.clearAllMocks();
	mockGetAllProducts.mockResolvedValue([]);
	[
		mockAmazonRefreshPrices,
		mockShopifyRefreshPrices,
		mockSkimlinksRefreshPrices,
	].forEach((mock) =>
		mock.mockImplementation((products) =>
			Promise.resolve({ updated: [], notUpdated: products }),
		),
	);
});

function updater() {
	return new ProductsUpdater(new DynamoService('TEST'));
}

describe('shouldSkipManualPrice', () => {
	it('skips an unexpired manual override', () => {
		const product = buildProduct({
			updatedBy: 'manualOverride',
			expiresAt: Date.now() + 60_000,
		});

		expect(updater()['shouldSkipManualPrice'](product)).toBe(true);
	});

	it('skips a manual override with no expiry', () => {
		const product = buildProduct({ updatedBy: 'manualOverride' });

		expect(updater()['shouldSkipManualPrice'](product)).toBe(true);
	});

	it('does not skip an expired manual override', () => {
		const product = buildProduct({
			updatedBy: 'manualOverride',
			expiresAt: Date.now() - 60_000,
		});

		expect(updater()['shouldSkipManualPrice'](product)).toBe(false);
	});

	it('does not skip a product without a manual override', () => {
		const product = buildProduct({ updatedBy: 'priceProvider' });

		expect(updater()['shouldSkipManualPrice'](product)).toBe(false);
	});
});

describe('getProductsFromDB', () => {
	it('scans the product table and returns the items', async () => {
		const products = [
			buildProduct(),
			buildProduct(),
			buildProduct({ removed: 'true' }),
		];
		mockGetAllProducts.mockResolvedValue(products);

		await expect(updater().getProductsFromDB()).resolves.toEqual(
			products.slice(0, 2),
		);
		expect(mockGetAllProducts).toHaveBeenCalledWith({});
	});
});

describe('refreshPrices', () => {
	it('skips active manual overrides and refreshes expired manual overrides', async () => {
		const activeManualOverride = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/active-override',
			updatedBy: 'manualOverride',
			expiresAt: Date.now() + 60_000,
		});
		const permanentManualOverride = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/permanent',
			updatedBy: 'manualOverride',
		});
		const expiredManualOverride = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/expired-override',
			updatedBy: 'manualOverride',
			expiresAt: Date.now() - 60_000,
		});
		const noManualOverride = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/no-override',
			updatedBy: 'skimlinks',
		});
		mockGetAllProducts.mockResolvedValue([
			activeManualOverride,
			permanentManualOverride,
			expiredManualOverride,
			noManualOverride,
		]);

		await updater().refreshPrices();

		expect(mockShopifyRefreshPrices).toHaveBeenCalledWith([
			expiredManualOverride,
			noManualOverride,
		]);
		expect(mockSkimlinksRefreshPrices).toHaveBeenCalledWith([
			expiredManualOverride,
			noManualOverride,
		]);
	});

	it('routes amazon products to the amazon provider and the rest to shopify then skimlinks', async () => {
		const amazonCom = buildProduct({
			productMerchantUrl: 'https://amazon.com/dp/1',
		});
		const amazonCoUk = buildProduct({
			productMerchantUrl: 'https://www.amazon.co.uk/dp/2',
		});
		const other = buildProduct({
			productMerchantUrl: 'https://www.johnlewis.com/p/3',
		});
		mockGetAllProducts.mockResolvedValue([amazonCom, amazonCoUk, other]);

		await updater().refreshPrices();

		expect(mockAmazonRefreshPrices).toHaveBeenCalledWith([
			amazonCom,
			amazonCoUk,
		]);
		expect(mockShopifyRefreshPrices).toHaveBeenCalledWith([other]);
		expect(mockSkimlinksRefreshPrices).toHaveBeenCalledWith([other]);
	});

	it('only passes products shopify could not price on to skimlinks', async () => {
		const shopifyProduct = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/1',
		});
		const nonShopifyProduct = buildProduct({
			productMerchantUrl: 'https://www.johnlewis.com/p/2',
		});
		mockGetAllProducts.mockResolvedValue([shopifyProduct, nonShopifyProduct]);
		mockShopifyRefreshPrices.mockResolvedValue({
			updated: [shopifyProduct],
			notUpdated: [nonShopifyProduct],
		});
		mockSkimlinksRefreshPrices.mockResolvedValue({
			updated: [nonShopifyProduct],
			notUpdated: [],
		});

		await updater().refreshPrices();

		expect(mockShopifyRefreshPrices).toHaveBeenCalledWith([
			shopifyProduct,
			nonShopifyProduct,
		]);
		expect(mockSkimlinksRefreshPrices).toHaveBeenCalledWith([
			nonShopifyProduct,
		]);
		expect(mockUpdateProducts).toHaveBeenCalledWith({
			items: [shopifyProduct, nonShopifyProduct],
		});
	});

	it('does not call skimlinks when shopify prices every product', async () => {
		const shopifyProduct = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/1',
		});
		mockGetAllProducts.mockResolvedValue([shopifyProduct]);
		mockShopifyRefreshPrices.mockResolvedValue({
			updated: [shopifyProduct],
			notUpdated: [],
		});

		await updater().refreshPrices();

		expect(mockSkimlinksRefreshPrices).not.toHaveBeenCalled();
		expect(mockUpdateProducts).toHaveBeenCalledWith({
			items: [shopifyProduct],
		});
	});

	it('writes the combined updated products back to the table', async () => {
		const amazonProduct = buildProduct({
			productMerchantUrl: 'https://www.amazon.com/dp/1',
		});
		const shopifyProduct = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/2',
		});
		const skimlinksProduct = buildProduct({
			productMerchantUrl: 'https://www.target.com/p/3',
		});
		mockGetAllProducts.mockResolvedValue([
			amazonProduct,
			shopifyProduct,
			skimlinksProduct,
		]);
		mockAmazonRefreshPrices.mockResolvedValue({
			updated: [amazonProduct],
			notUpdated: [],
		});
		mockShopifyRefreshPrices.mockResolvedValue({
			updated: [shopifyProduct],
			notUpdated: [skimlinksProduct],
		});
		mockSkimlinksRefreshPrices.mockResolvedValue({
			updated: [skimlinksProduct],
			notUpdated: [],
		});

		await updater().refreshPrices();

		expect(mockUpdateProducts).toHaveBeenCalledWith({
			items: [amazonProduct, shopifyProduct, skimlinksProduct],
		});
	});

	it('keeps an active manual override with an invalid URL out of providers', async () => {
		const product = buildProduct({
			productMerchantUrl: 'not a valid URL',
			updatedBy: 'manualOverride',
			expiresAt: Date.now() + 60_000,
		});
		mockGetAllProducts.mockResolvedValue([product]);

		await updater().refreshPrices();

		expect(mockAmazonRefreshPrices).not.toHaveBeenCalled();
		expect(mockShopifyRefreshPrices).not.toHaveBeenCalled();
		expect(mockSkimlinksRefreshPrices).not.toHaveBeenCalled();
		expect(mockUpdateProducts).toHaveBeenCalledWith({ items: [] });
		expect(mockWriteProductsToS3File).toHaveBeenCalledWith([product]);
	});

	it('keeps skipped manual overrides in the S3 feed but out of provider and DB updates', async () => {
		const manualOverride = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/manual',
			updatedBy: 'manualOverride',
			expiresAt: Date.now() + 60_000,
		});
		const refreshedProduct = buildProduct({
			productMerchantUrl: 'https://shop.example.com/products/refreshed',
		});
		mockGetAllProducts.mockResolvedValue([manualOverride, refreshedProduct]);
		mockShopifyRefreshPrices.mockResolvedValue({
			updated: [refreshedProduct],
			notUpdated: [],
		});

		await updater().refreshPrices();

		expect(mockShopifyRefreshPrices).toHaveBeenCalledWith([refreshedProduct]);
		expect(mockSkimlinksRefreshPrices).not.toHaveBeenCalled();
		expect(mockUpdateProducts).toHaveBeenCalledWith({
			items: [refreshedProduct],
		});
		expect(mockWriteProductsToS3File).toHaveBeenCalledWith([
			refreshedProduct,
			manualOverride,
		]);
	});
});
