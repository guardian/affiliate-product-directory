import type { DeletedContent } from '@guardian/content-api-models/crier/event/v1/deletedContent';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import type { ContentType } from '@guardian/content-api-models/v1/contentType';
import { type Handler } from 'aws-lambda';
import { getConfig } from './config';
import { deserializeEvent } from './deserialize';
import type { CrierEventDetail } from './eventbridge-models';
import {
	ContentDeleteEventDetail,
	ContentUpdateEventDetail,
	type CrierEventBridgeEvent,
} from './eventbridge-models';
import { handleContentUpdate } from './update-processor';

export async function main() {
	const { stage, app } = getConfig();
	const msg = `Hello from ${app} in ${stage}! The time is ${new Date().toString()}`;
	console.log(msg);
	return Promise.resolve(msg);
}

export const eventHandler: Handler<CrierEventBridgeEvent, void> = (event) => {
	switch (event['detail-type']) {
		case ContentUpdateEventDetail:
		case ContentDeleteEventDetail: {
			processRecord({
				eventDetail: event.detail,
			});
			return;
		}
		default: {
			console.error(`Unknown event payload: ${JSON.stringify(event)}`);
		}
	}
};

function processRecord({ eventDetail }: { eventDetail: CrierEventDetail }) {
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
						return handleContentUpdate({
							content: evt.payload.content,
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
		return;
	}
}

function handleContentUpdateByCapiUrl({
	contentType,
	capiUrl,
	internalRevision,
}: {
	contentType?: ContentType;
	capiUrl: string;
	internalRevision?: number;
}) {
	throw new Error('Function not implemented.');
}

function handleDeletedContent(deletedContent: DeletedContent) {
	throw new Error('Function not implemented.');
}
