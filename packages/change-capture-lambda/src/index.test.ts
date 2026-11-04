import { handler } from './index';
import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

// Set environment variable
process.env.BUCKET_NAME = 'test-change-log-bucket';

// Mock S3 client
const s3Mock = mockClient(S3Client);

beforeEach(() => {
	s3Mock.reset();
});

describe('Change Capture Lambda Handler', () => {
	describe('INSERT event', () => {
		it('should process INSERT events and write to S3', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '1',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'amazon.com/product123' },
								articleUrl: { S: 'https://article.com/123' },
							},
							NewImage: {
								productMerchantUrl: { S: 'amazon.com/product123' },
								articleUrl: { S: 'https://article.com/123' },
								price: { N: '29.99' },
								availability: { S: 'in-stock' },
							},
							SequenceNumber: '111',
							SizeBytes: 100,
							ApproximateCreationDateTime: 1705318200,
						},
						awsRegion: 'eu-west-1',
						eventName: 'INSERT',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
			const call = s3Mock.commandCalls(PutObjectCommand)[0];
			const input = call.args[0].input;

			expect(input.Bucket).toBe('test-change-log-bucket');
			expect(input.Key).toMatch(/^changes\/2024-01-15T\d{2}:30:00\.000Z_111\.jsonl$/);

			const body = JSON.parse(input.Body as string);
			expect(body.event_type).toBe('INSERT');
			expect(body.sequence_number).toBe('111');
			expect(body.productMerchantUrl).toBe('amazon.com/product123');
			expect(body.price).toBe(29.99);
		});
	});

	describe('MODIFY event', () => {
		it('should process MODIFY events using NewImage', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '2',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'amazon.com/product456' },
								articleUrl: { S: 'https://article.com/456' },
							},
							OldImage: {
								productMerchantUrl: { S: 'amazon.com/product456' },
								articleUrl: { S: 'https://article.com/456' },
								price: { N: '39.99' },
								availability: { S: 'in-stock' },
							},
							NewImage: {
								productMerchantUrl: { S: 'amazon.com/product456' },
								articleUrl: { S: 'https://article.com/456' },
								price: { N: '34.99' },
								availability: { S: 'on-sale' },
							},
							SequenceNumber: '222',
							SizeBytes: 150,
							ApproximateCreationDateTime: 1705318300,
						},
						awsRegion: 'eu-west-1',
						eventName: 'MODIFY',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			const call = s3Mock.commandCalls(PutObjectCommand)[0];
			const body = JSON.parse(call.args[0].input.Body as string);

			expect(body.event_type).toBe('MODIFY');
			expect(body.price).toBe(34.99);
		});
	});

	describe('REMOVE event', () => {
		it('should process REMOVE events using OldImage', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '3',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'amazon.com/product789' },
								articleUrl: { S: 'https://article.com/789' },
							},
							OldImage: {
								productMerchantUrl: { S: 'amazon.com/product789' },
								articleUrl: { S: 'https://article.com/789' },
								price: { N: '49.99' },
							},
							SequenceNumber: '333',
							SizeBytes: 80,
							ApproximateCreationDateTime: 1705318400,
						},
						awsRegion: 'eu-west-1',
						eventName: 'REMOVE',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
			const call = s3Mock.commandCalls(PutObjectCommand)[0];
			const body = JSON.parse(call.args[0].input.Body as string);

			expect(body.event_type).toBe('REMOVE');
			expect(body.sequence_number).toBe('333');
		});
	});

	describe('S3 Key generation', () => {
		it('should generate deterministic S3 keys for the same record', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const record: DynamoDBRecord = {
				eventID: '4',
				eventVersion: '1.0',
				dynamodb: {
					Keys: {
						productMerchantUrl: { S: 'test.com/prod' },
						articleUrl: { S: 'https://test.com/article' },
					},
					NewImage: {
						productMerchantUrl: { S: 'test.com/prod' },
						articleUrl: { S: 'https://test.com/article' },
						price: { N: '99.99' },
					},
					SequenceNumber: '444',
					SizeBytes: 100,
					ApproximateCreationDateTime: 1705318500,
				},
				awsRegion: 'eu-west-1',
				eventName: 'INSERT',
				eventSource: 'aws:dynamodb',
			} as DynamoDBRecord;

			const event1: DynamoDBStreamEvent = { Records: [record] };
			const event2: DynamoDBStreamEvent = { Records: [{ ...record }] };

			await handler(event1, {} as any);
			const call1 = s3Mock.commandCalls(PutObjectCommand)[0];
			const key1 = call1.args[0].input.Key;

			s3Mock.reset();

			await handler(event2, {} as any);
			const call2 = s3Mock.commandCalls(PutObjectCommand)[0];
			const key2 = call2.args[0].input.Key;

			expect(key1).toBe(key2);
		});
	});

	describe('Error handling', () => {
		it('should skip records with no SequenceNumber', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '5',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'test.com/prod' },
								articleUrl: { S: 'https://test.com/article' },
							},
							NewImage: {
								productMerchantUrl: { S: 'test.com/prod' },
								articleUrl: { S: 'https://test.com/article' },
								price: { N: '99.99' },
							},
							SizeBytes: 100,
							ApproximateCreationDateTime: 1705318600,
						},
						awsRegion: 'eu-west-1',
						eventName: 'INSERT',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
		});

		it('should handle multiple records', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '8',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'amazon.com/1' },
								articleUrl: { S: 'https://test.com/1' },
							},
							NewImage: {
								productMerchantUrl: { S: 'amazon.com/1' },
								articleUrl: { S: 'https://test.com/1' },
								price: { N: '10' },
							},
							SequenceNumber: '777',
							SizeBytes: 100,
							ApproximateCreationDateTime: 1705318900,
						},
						awsRegion: 'eu-west-1',
						eventName: 'INSERT',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
					{
						eventID: '9',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'amazon.com/2' },
								articleUrl: { S: 'https://test.com/2' },
							},
							NewImage: {
								productMerchantUrl: { S: 'amazon.com/2' },
								articleUrl: { S: 'https://test.com/2' },
								price: { N: '20' },
							},
							SequenceNumber: '888',
							SizeBytes: 100,
							ApproximateCreationDateTime: 1705319000,
						},
						awsRegion: 'eu-west-1',
						eventName: 'INSERT',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(2);
		});

		it('should correctly unmarshall various DynamoDB data types', async () => {
			s3Mock.on(PutObjectCommand).resolves({});

			const event: DynamoDBStreamEvent = {
				Records: [
					{
						eventID: '10',
						eventVersion: '1.0',
						dynamodb: {
							Keys: {
								productMerchantUrl: { S: 'test.com/prod' },
								articleUrl: { S: 'https://test.com/article' },
							},
							NewImage: {
								productMerchantUrl: { S: 'test.com/prod' },
								articleUrl: { S: 'https://test.com/article' },
								price: { N: '29.99' },
								inStock: { BOOL: true },
								tags: { L: [{ S: 'electronics' }, { S: 'gadget' }] },
								metadata: {
									M: {
										brand: { S: 'TestBrand' },
										rating: { N: '4.5' },
									},
								},
								quantity: { N: '100' },
							},
							SequenceNumber: '999',
							SizeBytes: 200,
							ApproximateCreationDateTime: 1705319100,
						},
						awsRegion: 'eu-west-1',
						eventName: 'INSERT',
						eventSource: 'aws:dynamodb',
					} as DynamoDBRecord,
				],
			};

			await handler(event, {} as any);

			const call = s3Mock.commandCalls(PutObjectCommand)[0];
			const body = JSON.parse(call.args[0].input.Body as string);

			expect(body.price).toBe(29.99);
			expect(body.inStock).toBe(true);
			expect(body.tags).toEqual(['electronics', 'gadget']);
			expect(body.metadata).toEqual({ brand: 'TestBrand', rating: 4.5 });
			expect(body.quantity).toBe(100);
		});
	});
});
