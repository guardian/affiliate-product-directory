import type { Product } from '@common/models';
import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetAllProducts } from '@mocks/DatabaseServiceMock';
import { buildProduct } from '@mocks/ProductFixtures';
import { mockWriteProductsToS3File } from '@mocks/S3FileWriterMock';
import type * as CsvPublisherModule from './csv-publisher';

let publishPricesCsv: typeof CsvPublisherModule.publishPricesCsv;

beforeAll(async () => {
	// Import after the mocks above have registered, otherwise the real
	// modules get pulled in first and the mocks never take effect.
	({ publishPricesCsv } = await import('./csv-publisher'));
});

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(console, 'log').mockImplementation(() => {});
	mockGetAllProducts.mockResolvedValue([]);
	mockWriteProductsToS3File.mockResolvedValue();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('publishPricesCsv', () => {
	it('reads the whole pricing table once', async () => {
		await publishPricesCsv();

		expect(mockGetAllProducts).toHaveBeenCalledTimes(1);
		expect(mockGetAllProducts).toHaveBeenCalledWith({});
	});

	it('writes every product still in the directory that has a price', async () => {
		const pricedToday = buildProduct({ updatedAt: Date.now() });
		// Keeps the price an earlier run gave it.
		const pricedEarlier = buildProduct({ updatedAt: 1760000000000 });
		const removed = buildProduct({ removed: 'true', removedAt: 1 });
		// As the directory adds a product, before any provider has priced it.
		const neverPriced: Product = {
			productMerchantUrl: 'https://www.argos.co.uk/product/4',
			region: 'GB',
			createdAt: 1,
			updatedAt: 1,
			updatedBy: 'test',
		};
		mockGetAllProducts.mockResolvedValue([
			pricedToday,
			removed,
			neverPriced,
			pricedEarlier,
		]);

		await publishPricesCsv();

		expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(1);
		expect(mockWriteProductsToS3File).toHaveBeenCalledWith([
			pricedToday,
			pricedEarlier,
		]);
	});

	it('writes an empty CSV when nothing has a price', async () => {
		await publishPricesCsv();

		expect(mockWriteProductsToS3File).toHaveBeenCalledWith([]);
	});

	it('fails without writing when the table cannot be read', async () => {
		mockGetAllProducts.mockRejectedValue(new Error('DynamoDB is unavailable'));

		await expect(publishPricesCsv()).rejects.toThrow('DynamoDB is unavailable');
		expect(mockWriteProductsToS3File).not.toHaveBeenCalled();
	});

	it('fails when the CSV cannot be written', async () => {
		mockWriteProductsToS3File.mockRejectedValue(new Error('S3 is unavailable'));

		await expect(publishPricesCsv()).rejects.toThrow('S3 is unavailable');
	});
});
