import { jest } from '@jest/globals';
import { mockAmazonRefreshPrices } from '@mocks/AmazonPriceProviderMock';
import { mockBatchUpdateItems, mockGetAllItems } from '@mocks/DynamoDBMock';
import { buildProduct } from '@mocks/ProductFixtures';
import { mockSkimlinksRefreshPrices } from '@mocks/SkimlinksPriceProviderMock';
import type * as ProductsUpdaterModule from './ProductsUpdater';

const tableName = 'products-table';

let ProductsUpdater: typeof ProductsUpdaterModule.ProductsUpdater;

beforeAll(async () => {
	({ ProductsUpdater } = await import('./ProductsUpdater'));
});

beforeEach(() => {
	jest.clearAllMocks();
	mockGetAllItems.mockResolvedValue([]);
	mockAmazonRefreshPrices.mockResolvedValue([]);
	mockSkimlinksRefreshPrices.mockResolvedValue([]);
});

function updater() {
	return new ProductsUpdater({ productTableName: tableName });
}

describe('getProductsFromDB', () => {
	it('scans the product table and returns the items', async () => {
		const products = [buildProduct(), buildProduct()];
		mockGetAllItems.mockResolvedValue(products);

		await expect(updater().getProductsFromDB()).resolves.toEqual(products);
		expect(mockGetAllItems).toHaveBeenCalledWith({ tableName });
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
		mockGetAllItems.mockResolvedValue([amazonCom, amazonCoUk, other]);

		await updater().refreshPrices();

		expect(mockAmazonRefreshPrices).toHaveBeenCalledWith([
			amazonCom,
			amazonCoUk,
		]);
		expect(mockSkimlinksRefreshPrices).toHaveBeenCalledWith([other]);
	});

	it('writes the combined updated products back to the table', async () => {
		mockGetAllItems.mockResolvedValue([
			buildProduct({ productMerchantUrl: 'https://www.amazon.com/dp/1' }),
			buildProduct({ productMerchantUrl: 'https://www.target.com/p/2' }),
		]);

		const amazonUpdated = buildProduct({ price: 1 });
		const skimlinksUpdated = buildProduct({ price: 2 });
		mockAmazonRefreshPrices.mockResolvedValue([amazonUpdated]);
		mockSkimlinksRefreshPrices.mockResolvedValue([skimlinksUpdated]);

		await updater().refreshPrices();

		expect(mockBatchUpdateItems).toHaveBeenCalledWith({
			items: [amazonUpdated, skimlinksUpdated],
			tableName,
		});
	});
});
