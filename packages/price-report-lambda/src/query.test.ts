import { BigQuery } from '@google-cloud/bigquery';
import { QueryRecordSchema } from './query';

describe('QueryRecordSchema', () => {
	it('parses BigQuery decimal and timestamp values without losing precision', () => {
		const rows = BigQuery.mergeSchemaWithRows_(
			{
				fields: [
					{ name: 'productMerchantUrl', type: 'STRING' },
					{ name: 'previous_price', type: 'BIGNUMERIC' },
					{ name: 'current_price', type: 'BIGNUMERIC' },
					{ name: 'previous_availability', type: 'STRING' },
					{ name: 'current_availability', type: 'STRING' },
					{ name: 'syncDate', type: 'TIMESTAMP' },
				],
			},
			[
				{
					f: [
						{ v: 'https://example.com/product' },
						{ v: '12345678901234567890.123456789' },
						{ v: '19.99' },
						{ v: null },
						{ v: 'in-stock' },
						{ v: '1760000000' },
					],
				},
			],
			{ wrapIntegers: false },
		);

		expect(QueryRecordSchema.array().parse(rows)).toEqual([
			{
				productMerchantUrl: 'https://example.com/product',
				previous_price: '12345678901234567890.123456789',
				current_price: '19.99',
				previous_availability: null,
				current_availability: 'in-stock',
				syncDate: '2025-10-09T08:53:20.000Z',
			},
		]);
	});

	it('accepts null prices and availability', () => {
		const record = {
			productMerchantUrl: 'https://example.com/product',
			previous_price: null,
			current_price: null,
			previous_availability: null,
			current_availability: null,
			syncDate: BigQuery.timestamp('2026-11-26T12:00:00.000Z'),
		};

		expect(QueryRecordSchema.parse(record)).toEqual({
			...record,
			syncDate: '2026-11-26T12:00:00.000Z',
		});
	});
});
