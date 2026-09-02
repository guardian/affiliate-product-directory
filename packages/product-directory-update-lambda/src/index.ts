import type { DeletedContent } from '@guardian/content-api-models/crier/event/v1/deletedContent';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import type { ContentType } from '@guardian/content-api-models/v1/contentType';
import { type Handler } from 'aws-lambda';
import { getConfig } from './config';
import { DynamoService } from './database-service';
import { deserializeEvent } from './deserialize';
import type { CrierEventDetail } from './eventbridge-models';
import {
	ContentDeleteEventDetail,
	ContentUpdateEventDetail,
	type CrierEventBridgeEvent,
} from './eventbridge-models';
import { handleContentUpdate } from './update-processor';

export const eventHandler: Handler<CrierEventBridgeEvent, string> = async (
	event,
) => {
	const { stage, app } = getConfig();
	const dynamoService = new DynamoService(stage);

	const msg = `New event received in ${app} in ${stage}`;
	console.log(msg);

	switch (event['detail-type']) {
		case ContentUpdateEventDetail:
		case ContentDeleteEventDetail: {
			await processRecord({
				eventDetail: event.detail,
				dynamoService,
			});
			return msg;
		}
		default: {
			console.error(`Unknown event payload: ${JSON.stringify(event)}`);
			return msg;
		}
	}
};

async function processRecord({
	eventDetail,
	dynamoService,
}: {
	eventDetail: CrierEventDetail;
	dynamoService: DynamoService;
}): Promise<void> {
	try {
		const evt = deserializeEvent(eventDetail.event);

		//we're only interested in content updates
		if (evt.itemType != ItemType.CONTENT) {
			return;
		}

		console.log(
			`DEBUG Received event of type ${evt.eventType} for item of type ${evt.itemType}`,
		);
		switch (evt.eventType) {
			case EventType.DELETE:
				// ToDo: do nothing to the product price table but remove an article from the product-article table
				return;
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
		return; //if we get here, no action was taken
	} catch (err) {
		console.error(
			`ERROR Could not process data from Kinesis: ${(err as Error).toString()}`,
		);
		throw err;
	}
}

function handleContentUpdateByCapiUrl({
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- not yet implemented
	contentType,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- not yet implemented
	capiUrl,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- not yet implemented
	internalRevision,
}: {
	contentType?: ContentType;
	capiUrl: string;
	internalRevision?: number;
}) {
	throw new Error('Function not implemented.');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- not yet implemented
function handleDeletedContent(deletedContent: DeletedContent) {
	throw new Error('Function not implemented.');
}
