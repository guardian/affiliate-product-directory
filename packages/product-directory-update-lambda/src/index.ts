import type { DeletedContent } from '@guardian/content-api-models/crier/event/v1/deletedContent';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { type Handler } from 'aws-lambda';
import { getCapiBaseUrl, getConfig } from './config';
import { DynamoService } from './database-service';
import { deserializeEvent } from './deserialize';
import type {
	BackfillEventBridgeEvent,
	CrierEventDetail,
} from './eventbridge-models';
import {
	BackfillEventDetail,
	ContentDeleteEventDetail,
	ContentUpdateEventDetail,
	type CrierEventBridgeEvent,
} from './eventbridge-models';
import { handleContentUpdateByCapiUrl } from './retrievable-update-processor';
import { handleContentUpdate } from './update-processor';

export const eventHandler: Handler<
	CrierEventBridgeEvent | BackfillEventBridgeEvent,
	number
> = async (event) => {
	const { stage, app } = getConfig();
	const dynamoService = new DynamoService(stage);
	const capiBaseUrl = getCapiBaseUrl(stage);

	const msg = `New event received in ${app} in ${stage}`;
	console.log(msg);

	switch (event['detail-type']) {
		case ContentUpdateEventDetail:
		case ContentDeleteEventDetail: {
			return await processRecord({
				eventDetail: event.detail,
				dynamoService,
			});
		}
		case BackfillEventDetail: {
			return await processBackfillRecord({
				eventDetail: event.detail,
				capiBaseUrl,
				dynamoService,
			});
		}
		default: {
			console.error(`Unknown event payload: ${JSON.stringify(event)}`);
			return Promise.resolve(0);
		}
	}
};

async function processRecord({
	eventDetail,
	dynamoService,
}: {
	eventDetail: CrierEventDetail;
	dynamoService: DynamoService;
}): Promise<number> {
	try {
		const evt = deserializeEvent(eventDetail.event);

		//we're only interested in content updates
		if (evt.itemType != ItemType.CONTENT) {
			return 0;
		}

		console.log(
			`DEBUG Received event of type ${evt.eventType} for item of type ${evt.itemType}`,
		);
		switch (evt.eventType) {
			case EventType.DELETE:
				// ToDo: do nothing to the product price table but remove an article from the product-article table
				return 0;
			case EventType.UPDATE:
			case EventType.RETRIEVABLEUPDATE:
				switch (evt.payload?.kind) {
					case undefined: {
						console.log('DEBUG Event had no payload');
						break;
					}
					case 'content': {
						return await handleContentUpdate({
							content: evt.payload.content,
							dynamoService,
						});
					}
					case 'retrievableContent': {
						const { capiUrl, contentType, internalRevision } =
							evt.payload.retrievableContent;
						return handleContentUpdateByCapiUrl({
							capiUrl,
							contentType,
							internalRevision,
							dynamoService,
						});
					}
					case 'deletedContent': {
						return handleDeletedContent(evt.payload.deletedContent);
					}
					default:
						break;
				}
				break;
			default:
				console.error('ERROR Unknown event type ', evt.eventType);
		}
		return 0; //if we get here, no action was taken
	} catch (err) {
		console.error(`ERROR Could not process data: ${(err as Error).toString()}`);
		throw err;
	}
}

async function processBackfillRecord({
	eventDetail,
	capiBaseUrl,
	dynamoService,
}: {
	eventDetail: BackfillEventDetail;
	capiBaseUrl: string;
	dynamoService: DynamoService;
}) {
	let totalCount = 0;

	console.log(
		`Received ${
			eventDetail.articleIds.length
		} articles to backfill: \n${eventDetail.articleIds.join(', \n')}`,
	);

	for (const articleId of eventDetail.articleIds) {
		totalCount += await handleContentUpdateByCapiUrl({
			capiUrl: `${capiBaseUrl}/${articleId}`,
			contentType: ContentType.ARTICLE,
			dynamoService,
		});
	}

	console.log(`Backfilled ${eventDetail.articleIds.length} articles`);

	return totalCount;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- not yet implemented
function handleDeletedContent(deletedContent: DeletedContent): number {
	throw new Error('Function not implemented.');
}
