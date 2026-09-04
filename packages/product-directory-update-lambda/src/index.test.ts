import type { Event } from '@guardian/content-api-models/crier/event/v1/event';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { jest } from '@jest/globals';
import type { Callback, EventBridgeEvent } from 'aws-lambda';
import Int64 from 'node-int64';
import type * as DeserializeModule from './deserialize';
import type { CrierEventDetail } from './eventbridge-models';

jest.unstable_mockModule('./deserialize', () => ({
	deserializeEvent: jest.fn(),
	deserializeItemResponse: jest.fn(),
}));

describe('The lambda', () => {
	beforeAll(() => {
		process.env.STACK = 'frontend';
		process.env.STAGE = 'TEST';
		process.env.APP = 'product-directory-update-lambda';
	});

	it('should return a message when an event fires', async () => {
		const { deserializeEvent } = (await import('./deserialize')) as jest.Mocked<
			typeof DeserializeModule
		>;
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
		deserializeEvent.mockReturnValue(testEvent);

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
		expect(response).toBe(0);
		expect(deserializeEvent).toHaveBeenCalledWith(testReq.event);
	});
});
