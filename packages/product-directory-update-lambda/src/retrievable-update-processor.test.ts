import type { RetrievableContent } from '@guardian/content-api-models/crier/event/v1/retrievableContent';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { jest } from '@jest/globals';
import type * as CapiModule from './capi';
import type { DynamoService } from './database-service';
import type * as RetrievableUpdateProcessor from './retrievable-update-processor';
import type * as UpdateProcessor from './update-processor';

const update: RetrievableContent = {
	capiUrl: 'https://api.com/path/to/article',
	id: 'path/to/article',
	contentType: ContentType.ARTICLE,
};
const content: Content = {
	apiUrl: 'api://path/to/content',
	id: 'path/to/content',
	isHosted: false,
	references: [],
	tags: [],
	type: ContentType.ARTICLE,
	webTitle: 'Test Article',
	webUrl: 'web://path/to/content',
};
const dynamoService = {} as DynamoService;

jest.unstable_mockModule('./capi', () => ({
	callCAPI: jest.fn(),
	PollingAction: {
		CONTENT_EXISTS: 0,
		CONTENT_MISSING: 1,
		CONTENT_GONE: 2,
		CONCIERGE_UNHAPPY: 3,
		INTERNAL_BUG: 4,
		UNEXPECTED_RESPONSE: 5,
		RATE_LIMITED: 6,
	},
}));

jest.unstable_mockModule('./update-processor', () => ({
	handleContentUpdate: jest.fn(),
}));

describe('handleContentUpdateByCapiUrl', () => {
	let callCAPI: jest.Mocked<typeof CapiModule>['callCAPI'];
	let PollingAction: typeof CapiModule.PollingAction;
	let handleContentUpdate: jest.Mocked<
		typeof UpdateProcessor
	>['handleContentUpdate'];
	let handleContentUpdateByCapiUrl: typeof RetrievableUpdateProcessor.handleContentUpdateByCapiUrl;

	beforeAll(async () => {
		({ callCAPI, PollingAction } = (await import('./capi')) as jest.Mocked<
			typeof CapiModule
		>);
		({ handleContentUpdate } =
			(await import('./update-processor')) as jest.Mocked<
				typeof UpdateProcessor
			>);
		({ handleContentUpdateByCapiUrl } =
			await import('./retrievable-update-processor'));
	});
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should retrieve content from CAPI then recall update-processor', async () => {
		callCAPI.mockResolvedValue({
			action: PollingAction.CONTENT_EXISTS,
			content,
		});
		handleContentUpdate.mockResolvedValue(3);

		const recordCount = await handleContentUpdateByCapiUrl({
			...update,
			dynamoService,
		});

		expect(callCAPI).toHaveBeenCalledWith(
			expect.stringContaining(update.capiUrl),
		);
		expect(handleContentUpdate).toHaveBeenCalledWith({
			content,
			dynamoService,
		});
		expect(recordCount).toEqual(3);
	});

	it('should ignore non-article content', async () => {
		const recordCount = await handleContentUpdateByCapiUrl({
			...update,
			contentType: ContentType.GALLERY,
			dynamoService,
		});

		expect(callCAPI).not.toHaveBeenCalled();
		expect(handleContentUpdate).not.toHaveBeenCalled();
		expect(recordCount).toEqual(0);
	});
	it('should throw if it gets an error response from CAPI', async () => {
		callCAPI.mockResolvedValue({
			action: PollingAction.INTERNAL_BUG,
			content,
		});
		await expect(
			handleContentUpdateByCapiUrl({ ...update, dynamoService }),
		).rejects.toEqual(
			new Error(
				'Could not handle retrievable update from CAPI: PollingAction code was 4. Allowing the lambda runtime to retry or DLQ.',
			),
		);
		expect(callCAPI).toHaveBeenCalledTimes(1);
		expect(handleContentUpdate).not.toHaveBeenCalled();
	});
	it('should disregard content that is taken down in the meantime', async () => {
		callCAPI.mockResolvedValue({
			action: PollingAction.CONTENT_MISSING,
			content: content,
		});
		const recordCount = await handleContentUpdateByCapiUrl({
			...update,
			dynamoService,
		});
		expect(callCAPI).toHaveBeenCalledTimes(1);
		expect(handleContentUpdate).toHaveBeenCalledTimes(0);
		expect(recordCount).toEqual(0);
	});
});
