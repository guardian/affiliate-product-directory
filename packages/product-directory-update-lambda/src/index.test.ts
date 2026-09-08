import type { Event } from '@guardian/content-api-models/crier/event/v1/event';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { jest } from '@jest/globals';
import type { Callback, EventBridgeEvent } from 'aws-lambda';
import Int64 from 'node-int64';
import type { CrierEventDetail } from './eventbridge-models';

jest.unstable_mockModule('./deserialize', () => ({
	deserializeEvent: jest.fn(),
	deserializeItemResponse: jest.fn(),
}));

const mockDynamoService = {};
const mockHandleTakedown = jest.fn().mockReturnValue(1);
const mockHandleContentUpdate = jest.fn().mockReturnValue(1);

jest.unstable_mockModule('./database-service', () => ({
	DynamoService: jest.fn(() => mockDynamoService),
}));

jest.unstable_mockModule('./product-remover', () => ({
	handleTakedown: mockHandleTakedown,
	markProductsAsRemovedFromArticle: jest.fn(),
}));

jest.unstable_mockModule('./update-processor', () => ({
	handleContentUpdate: mockHandleContentUpdate,
}));

const mockDeserializeEvent = jest.fn();
jest.unstable_mockModule('./deserialize', () => ({
	deserializeEvent: mockDeserializeEvent,
	deserializeItemResponse: jest.fn(),
}));

const mockHandleContentUpdateByCapiUrl = jest.fn().mockReturnValue(1);
jest.unstable_mockModule('./retrievable-update-processor', () => ({
	handleContentUpdateByCapiUrl: mockHandleContentUpdateByCapiUrl,
}));

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'frontend';
		process.env.STAGE = 'TEST';
		process.env.APP = 'product-directory-update-lambda';
	});
	beforeEach(() => {
		jest.clearAllMocks();
	});
	it('passes a DELETE event to handleTakedown', async () => {
		const { eventHandler } = await import('./index');

		const testContent: Content = {
			apiUrl: '',
			id: '',
			isHosted: false,
			references: [],
			tags: [],
			type: ContentType.ARTICLE,
			webTitle: '',
			webUrl: '',
		};
		const testEvent: Event = {
			dateTime: new Int64(String(Date.now())),
			eventType: EventType.DELETE,
			itemType: ItemType.CONTENT,
			payloadId: 'xxxxxxxxxx',
			payload: {
				content: testContent,
				kind: 'content',
			},
		};
		mockDeserializeEvent.mockReturnValue(testEvent);

		const testReq: CrierEventDetail = {
			'capi-models': '25.0.0',
			channels: ['open', 'feast', 'editions', 'newsletters'],
			event: 'GFR1ay1uZXdzL2FydGljbGUvMjAyNC9qdWwv… (73324 chars)',
		};
		const eventMock: EventBridgeEvent<'content-update', CrierEventDetail> = {
			account: '234786246782',
			detail: testReq,
			'detail-type': 'content-update',
			id: 'd8acb3c0-2426-43f3-beb5-bdf2f2c973b5',
			region: 'eu-west-1',
			resources: [],
			source: 'crier',
			time: '2024-07-10T13:10:44Z',
			version: '0',
		};
		const contextMock = {
			awsRequestId: '',
			callbackWaitsForEmptyEventLoop: false,
			functionName: '',
			functionVersion: '',
			invokedFunctionArn: '',
			logGroupName: '',
			logStreamName: '',
			memoryLimitInMB: '',
			getRemainingTimeInMillis(): number {
				return 0;
			},
			done: jest.fn(),
			fail: jest.fn(),
			succeed: jest.fn(),
		};
		const callbackMock: Callback<number> = (error, result) => {
			if (error) {
				console.error('Error:', error);
			} else {
				console.log('Result:', result);
			}
		};

		const response = await eventHandler(eventMock, contextMock, callbackMock);

		expect(response).toBe(1);
		expect(mockDeserializeEvent).toHaveBeenCalledWith(testReq.event);
		expect(mockHandleTakedown).toHaveBeenCalledWith(
			testEvent.payloadId,
			mockDynamoService,
		);
	});
	it('passes an UPDATE event to handleContentUpdate', async () => {
		const { eventHandler } = await import('./index');

		const testContent: Content = {
			apiUrl: '',
			id: '',
			isHosted: false,
			references: [],
			tags: [],
			type: ContentType.ARTICLE,
			webTitle: '',
			webUrl: '',
		};
		const testEvent: Event = {
			dateTime: new Int64(String(Date.now())),
			eventType: EventType.UPDATE,
			itemType: ItemType.CONTENT,
			payloadId: 'xxxxxxxxxx',
			payload: {
				content: testContent,
				kind: 'content',
			},
		};
		mockDeserializeEvent.mockReturnValue(testEvent);

		const testReq: CrierEventDetail = {
			'capi-models': '25.0.0',
			channels: ['open', 'feast', 'editions', 'newsletters'],
			event: 'GFR1ay1uZXdzL2FydGljbGUvMjAyNC9qdWwv… (73324 chars)',
		};
		const eventMock: EventBridgeEvent<'content-update', CrierEventDetail> = {
			account: '234786246782',
			detail: testReq,
			'detail-type': 'content-update',
			id: 'd8acb3c0-2426-43f3-beb5-bdf2f2c973b5',
			region: 'eu-west-1',
			resources: [],
			source: 'crier',
			time: '2024-07-10T13:10:44Z',
			version: '0',
		};
		const contextMock = {
			awsRequestId: '',
			callbackWaitsForEmptyEventLoop: false,
			functionName: '',
			functionVersion: '',
			invokedFunctionArn: '',
			logGroupName: '',
			logStreamName: '',
			memoryLimitInMB: '',
			getRemainingTimeInMillis(): number {
				return 0;
			},
			done: jest.fn(),
			fail: jest.fn(),
			succeed: jest.fn(),
		};
		const callbackMock: Callback<number> = (error, result) => {
			if (error) {
				console.error('Error:', error);
			} else {
				console.log('Result:', result);
			}
		};

		const response = await eventHandler(eventMock, contextMock, callbackMock);

		expect(response).toBe(1);
		expect(mockDeserializeEvent).toHaveBeenCalledWith(testReq.event);
		expect(mockHandleContentUpdate).toHaveBeenCalledWith({
			content: testContent,
			dynamoService: mockDynamoService,
		});
	});
	it('passes a RETRIEVABLEUPDATE event to handleContentUpdateByCapiUrl', async () => {
		const { eventHandler } = await import('./index');

		const testEvent: Event = {
			dateTime: new Int64(String(Date.now())),
			eventType: EventType.RETRIEVABLEUPDATE,
			itemType: ItemType.CONTENT,
			payloadId: 'xxxxxxxxxx',
			payload: {
				retrievableContent: {
					contentType: ContentType.ARTICLE,
					id: 'test',
					capiUrl: '/path/to/test',
					internalRevision: 1,
				},
				kind: 'retrievableContent',
			},
		};
		mockDeserializeEvent.mockReturnValue(testEvent);

		const testReq: CrierEventDetail = {
			'capi-models': '25.0.0',
			channels: ['open', 'feast', 'editions', 'newsletters'],
			event: 'GFR1ay1uZXdzL2FydGljbGUvMjAyNC9qdWwv… (73324 chars)',
		};
		const eventMock: EventBridgeEvent<'content-update', CrierEventDetail> = {
			account: '234786246782',
			detail: testReq,
			'detail-type': 'content-update',
			id: 'd8acb3c0-2426-43f3-beb5-bdf2f2c973b5',
			region: 'eu-west-1',
			resources: [],
			source: 'crier',
			time: '2024-07-10T13:10:44Z',
			version: '0',
		};
		const contextMock = {
			awsRequestId: '',
			callbackWaitsForEmptyEventLoop: false,
			functionName: '',
			functionVersion: '',
			invokedFunctionArn: '',
			logGroupName: '',
			logStreamName: '',
			memoryLimitInMB: '',
			getRemainingTimeInMillis(): number {
				return 0;
			},
			done: jest.fn(),
			fail: jest.fn(),
			succeed: jest.fn(),
		};
		const callbackMock: Callback<number> = (error, result) => {
			if (error) {
				console.error('Error:', error);
			} else {
				console.log('Result:', result);
			}
		};

		const response = await eventHandler(eventMock, contextMock, callbackMock);

		expect(response).toBe(1);
		expect(mockDeserializeEvent).toHaveBeenCalledWith(testReq.event);
		expect(mockHandleContentUpdateByCapiUrl).toHaveBeenCalledWith({
			contentType: ContentType.ARTICLE,
			capiUrl: '/path/to/test',
			internalRevision: 1,
			dynamoService: mockDynamoService,
		});
	});
});
