import type * as DatabaseServiceModule from '@common/database-service';
import { jest } from '@jest/globals';
import { mockAmazonRefreshPrices } from '@mocks/AmazonPriceProviderMock';
import {
	mockBatchUpdateProducts,
	mockGetAllProducts,
} from '@mocks/DatabaseServiceMock';
import { buildProduct } from '@mocks/ProductFixtures';
import { mockSkimlinksRefreshPrices } from '@mocks/SkimlinksPriceProviderMock';
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
	mockAmazonRefreshPrices.mockResolvedValue([]);
	mockSkimlinksRefreshPrices.mockResolvedValue([]);
});

function updater() {
	return new ProductsUpdater(new DynamoService('TEST'));
}

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
	it('routes amazon products to the amazon provider and the rest to skimlinks', async () => {
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
		expect(mockSkimlinksRefreshPrices).toHaveBeenCalledWith([other]);
	});

	it('writes the combined updated products back to the table', async () => {
		mockGetAllProducts.mockResolvedValue([
			buildProduct({ productMerchantUrl: 'https://www.amazon.com/dp/1' }),
			buildProduct({ productMerchantUrl: 'https://www.target.com/p/2' }),
		]);

		const amazonUpdated = buildProduct({ price: 1 });
		const skimlinksUpdated = buildProduct({ price: 2 });
		mockAmazonRefreshPrices.mockResolvedValue([amazonUpdated]);
		mockSkimlinksRefreshPrices.mockResolvedValue([skimlinksUpdated]);

		await updater().refreshPrices();

		expect(mockBatchUpdateProducts).toHaveBeenCalledWith({
			items: [amazonUpdated, skimlinksUpdated],
		});
	});
});
