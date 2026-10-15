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
