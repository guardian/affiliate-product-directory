import type { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { jest } from '@jest/globals';
import { buildProduct } from '../../mocks/ProductFixtures';
import type * as S3FileWriterModule from './S3FileWriter';
import '@mocks/ConfigMock';

let S3FileWriter: typeof S3FileWriterModule.S3FileWriter;

beforeAll(async () => {
	({ S3FileWriter } = await import('./S3FileWriter'));
});

function fileWriter() {
	return new S3FileWriter();
}

describe('convertProductsToCsv', () => {
	it('creates a CSV string listing url and prices', () => {
		const products = [
			buildProduct({
				productMerchantUrl: 'amazon.com',
				currency: 'USD',
			}),
			buildProduct({
				productMerchantUrl: 'argos.com',
				currency: 'GBP',
			}),
		];
		const result = fileWriter().convertProductsToCsv(products);
		expect(result).toEqual(`amazon.com,$,9.99
argos.com,£,9.99`);
	});
});

describe('convertProductsToJson', () => {
	it('creates a JSON map of each url to every field of its item', () => {
		const usProduct = buildProduct({
			productMerchantUrl: 'https://amazon.com/dp/1',
			currency: 'USD',
			region: 'US',
			updatedBy: 'amazon',
		});
		const ukProduct = buildProduct({
			productMerchantUrl: 'https://argos.co.uk/product/2',
			price: 24.5,
			updatedAt: 1760000000000,
		});

		const result: unknown = JSON.parse(
			fileWriter().convertProductsToJson([usProduct, ukProduct]),
		);

		expect(result).toEqual({
			'https://amazon.com/dp/1': usProduct,
			'https://argos.co.uk/product/2': ukProduct,
		});
	});

	it('creates an empty map when there are no products', () => {
		expect(fileWriter().convertProductsToJson([])).toEqual('{}');
	});
});

describe('writeProductsToS3Files', () => {
	const s3Send = jest.fn<(command: PutObjectCommand) => Promise<unknown>>();

	function fileWriterWithFakeS3() {
		return new S3FileWriter({ send: s3Send } as unknown as S3Client);
	}

	const pricedInThisRun = buildProduct({
		productMerchantUrl: 'https://amazon.com/dp/1',
		currency: 'USD',
	});
	// Still has the price an earlier run gave it.
	const pricedEarlier = buildProduct({
		productMerchantUrl: 'https://argos.co.uk/product/2',
		price: 24.5,
		updatedAt: 1760000000000,
	});
	const products = [pricedInThisRun, pricedEarlier];

	beforeEach(() => {
		s3Send.mockReset();
		s3Send.mockResolvedValue({});
	});

	it('writes every product as CSV, then as JSON', async () => {
		await fileWriterWithFakeS3().writeProductsToS3Files(products);

		expect(s3Send).toHaveBeenCalledTimes(2);
		const [csvPut, jsonPut] = s3Send.mock.calls.map(
			([command]) => command.input,
		);
		expect(csvPut).toMatchObject({
			Key: 'TEST/affiliates/product-prices.csv',
			Body: `https://amazon.com/dp/1,$,9.99
https://argos.co.uk/product/2,£,24.5`,
		});
		expect(jsonPut).toMatchObject({
			Key: 'TEST/affiliates/cached-product-prices.json',
			ContentType: 'application/json',
		});
		expect(JSON.parse(jsonPut?.Body as string)).toEqual({
			'https://amazon.com/dp/1': pricedInThisRun,
			'https://argos.co.uk/product/2': pricedEarlier,
		});
	});

	it('fails, without writing the JSON, when the CSV cannot be written', async () => {
		s3Send.mockRejectedValueOnce(new Error('S3 is unavailable'));

		await expect(
			fileWriterWithFakeS3().writeProductsToS3Files(products),
		).rejects.toThrow('S3 is unavailable');

		expect(s3Send).toHaveBeenCalledTimes(1);
		expect(s3Send.mock.calls[0]?.[0].input.Key).toBe(
			'TEST/affiliates/product-prices.csv',
		);
	});

	it('fails when the JSON cannot be written, after the CSV has been', async () => {
		s3Send
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new Error('S3 is unavailable'));

		await expect(
			fileWriterWithFakeS3().writeProductsToS3Files(products),
		).rejects.toThrow('S3 is unavailable');

		expect(s3Send).toHaveBeenCalledTimes(2);
	});
});
