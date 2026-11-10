import type { Product } from '@common/models';
import { jest } from '@jest/globals';
import '@mocks/ConfigMock';
import { mockGetAllProducts } from '@mocks/DatabaseServiceMock';
import { buildProduct } from '@mocks/ProductFixtures';
import { mockWriteProductsToS3File } from '@mocks/S3FileWriterMock';
import type { DynamoDBRecord } from 'aws-lambda';
import type * as CsvPublisherModule from './csv-publisher';

let publishPricesCsv: typeof CsvPublisherModule.publishPricesCsv;
let createChangeHandler: typeof CsvPublisherModule.createChangeHandler;

beforeAll(async () => {
	// Import after the mocks above have registered, otherwise the real
	// modules get pulled in first and the mocks never take effect.
	({ publishPricesCsv, createChangeHandler } = await import('./csv-publisher'));
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

describe('createChangeHandler', () => {
	// When the price run wrote to the table.
	const priceRun = Date.parse('2026-10-14T15:10:20.500Z');
	// When the stream delivers the price run's batches, after their 1-minute window.
	const batchesArrive = priceRun + 60_000;

	/** A stream record for a change made at `ms`, with the timestamp rounded down as DynamoDB does. */
	const changeAt = (ms: number): DynamoDBRecord => ({
		dynamodb: { ApproximateCreationDateTime: Math.floor(ms / 1000) },
	});

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(batchesArrive);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('rewrites the CSV for the first batch', async () => {
		const handleChanges = createChangeHandler();

		await handleChanges([changeAt(priceRun)]);

		expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(1);
	});

	it('rewrites once when a price run arrives as one batch per shard', async () => {
		const handleChanges = createChangeHandler();

		await handleChanges([changeAt(priceRun), changeAt(priceRun + 300)]);
		jest.setSystemTime(batchesArrive + 600);
		await handleChanges([changeAt(priceRun + 100)]);
		jest.setSystemTime(batchesArrive + 1_100);
		await handleChanges([changeAt(priceRun + 200), changeAt(priceRun + 400)]);

		expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(1);
	});

	it.each([
		['within the margin before', -3_000],
		['just after', 400],
		['well after', 10_000],
	])(
		'rewrites when a change was made %s the last rewrite read the table',
		async (_, offset) => {
			const handleChanges = createChangeHandler();
			await handleChanges([changeAt(priceRun)]);

			jest.setSystemTime(batchesArrive + offset + 60_000);
			await handleChanges([
				changeAt(priceRun),
				changeAt(batchesArrive + offset),
			]);

			expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(2);
		},
	);

	it('rewrites when a change has no timestamp', async () => {
		const handleChanges = createChangeHandler();
		await handleChanges([changeAt(priceRun)]);

		jest.setSystemTime(batchesArrive + 600);
		await handleChanges([changeAt(priceRun), { dynamodb: {} }]);

		expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(2);
	});

	it('rewrites again after a failed rewrite', async () => {
		const handleChanges = createChangeHandler();
		mockWriteProductsToS3File.mockRejectedValueOnce(
			new Error('S3 is unavailable'),
		);

		await expect(handleChanges([changeAt(priceRun)])).rejects.toThrow(
			'S3 is unavailable',
		);
		jest.setSystemTime(batchesArrive + 600);
		await handleChanges([changeAt(priceRun)]);

		expect(mockWriteProductsToS3File).toHaveBeenCalledTimes(2);
	});
});
