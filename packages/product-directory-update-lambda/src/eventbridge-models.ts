import type { EventBridgeEvent } from 'aws-lambda';

export interface CrierEventDetail {
	'capi-models'?: string;
	channels?: string[];
	event: string; //Base64-encoded Thrift event
}

export const ContentUpdateEventDetail = 'content-update';
export const ContentDeleteEventDetail = 'content-delete';

export type CrierEventBridgeEvent = EventBridgeEvent<
	typeof ContentUpdateEventDetail | typeof ContentDeleteEventDetail,
	CrierEventDetail
>;
