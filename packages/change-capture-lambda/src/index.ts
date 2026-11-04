import {
	DynamoDBStreamEvent,
	DynamoDBRecord,
	Context,
} from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1' });

interface ChangeRecord {
	event_type: string;
	event_time: string;
	sequence_number: string;
	[key: string]: unknown;
}

/**
 * Convert DynamoDB record to change log entry
 */
function convertToChangeRecord(record: DynamoDBRecord): ChangeRecord | null {
	const { dynamodb, eventName, eventID } = record;

	if (!dynamodb || !eventName) {
		console.warn('Record missing dynamodb or eventName', record);
		return null;
	}

	// Get sequence number from event ID (or use a fallback)
	const sequenceNumber = eventID || `${Date.now()}-${Math.random()}`;

	if (!dynamodb.SequenceNumber) {
		console.warn(
			`Record with eventID ${sequenceNumber} has no SequenceNumber, skipping`,
			record,
		);
		return null;
	}

	// Determine which image to use
	const image = eventName === 'REMOVE' ? dynamodb.OldImage : dynamodb.NewImage;

	if (!image) {
		console.warn(
			`Record with eventID ${sequenceNumber} has no image for event ${eventName}`,
			record,
		);
		return null;
	}

	// Unmarshall the DynamoDB item
	const unmarshalled = unmarshall(image as Record<string, any>);

	// Get approximate creation time
	const approximateCreationDateTime = dynamodb.ApproximateCreationDateTime
		? new Date(dynamodb.ApproximateCreationDateTime * 1000).toISOString()
		: new Date().toISOString();

	// Build the change record
	const changeRecord: ChangeRecord = {
		event_type: eventName,
		event_time: approximateCreationDateTime,
		sequence_number: dynamodb.SequenceNumber,
		...unmarshalled,
	};

	return changeRecord;
}

/**
 * Generate deterministic S3 key from change record
 */
function generateS3Key(record: ChangeRecord): string {
	const timestamp = record.event_time;
	const sequenceNumber = record.sequence_number;
	return `changes/${timestamp}_${sequenceNumber}.jsonl`;
}

/**
 * Lambda handler for processing DynamoDB stream records
 */
export async function handler(
	event: DynamoDBStreamEvent,
	_context: Context,
): Promise<void> {
	const bucketName = process.env.BUCKET_NAME || '';
	console.log('Processing', event.Records.length, 'records');

	const uploads = event.Records.map(async (record) => {
		const changeRecord = convertToChangeRecord(record);

		if (!changeRecord) {
			return; // Skip invalid records
		}

		const s3Key = generateS3Key(changeRecord);
		const jsonContent = JSON.stringify(changeRecord);

		console.log(`Writing to s3://${bucketName}/${s3Key}`);

		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: bucketName,
					Key: s3Key,
					Body: jsonContent,
					ContentType: 'application/json',
				}),
			);
		} catch (error) {
			console.error(`Failed to write ${s3Key}:`, error);
			throw error; // Trigger retry/DLQ
		}
	});

	await Promise.all(uploads);
	console.log('Successfully processed all records');
}
