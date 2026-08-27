/* Implementation from recipes-backend */
/* eslint @typescript-eslint/naming-convention: "off"  -- PollingAction uses a more CAPI-like convention*/
import type { Content } from '@guardian/content-api-models/v1/content';
import { getCapiKey } from './config';
import { deserializeItemResponse } from './deserialize';

export enum PollingAction {
	CONTENT_EXISTS,
	CONTENT_MISSING,
	CONTENT_GONE,
	CONCIERGE_UNHAPPY,
	INTERNAL_BUG,
	UNEXPECTED_RESPONSE,
	RATE_LIMITED,
}

export interface PollingResult {
	action: PollingAction;
	content?: Content;
}

function addCapiKeyParam(capiUrl: string): string {
	const capiKey = getCapiKey();
	return `${capiUrl}&api-key=${capiKey}`;
}

/**
 Makes a request to CAPI.
 @param capiUrl - Full URL to hit, including request parameters minus API key
 @return a Promise containing a PollingResult object indicating if the requested object exists or not, and containing
 the deserialised content if it does.
 */
export async function callCAPI(capiUrl: string): Promise<PollingResult> {
	const response = await fetch(addCapiKeyParam(capiUrl));
	const contentBuffer = await response.arrayBuffer();

	const contentBody =
		response.status === 200
			? deserializeItemResponse(Buffer.from(contentBuffer))
			: null; //this will throw if the content is invalid

	switch (response.status) {
		case 200: //we got the content :D.
			if (contentBody?.content) {
				return {
					action: PollingAction.CONTENT_EXISTS,
					content: contentBody.content,
				};
			} else {
				throw new Error('Found content, but result object was blank?!');
			}
		case 404: //content does not exist.
			console.log(`Nothing found for ${capiUrl}`);
			return {
				action: PollingAction.CONTENT_MISSING,
			};
		case 410: //content has gone. Hmmm. Is that what we want??
			console.log(`Content for ${capiUrl} has GONE in CAPI`);
			return {
				action: PollingAction.CONTENT_GONE,
			};
		case 429: //we hit our rate limit
			console.log(`Hit our rate limit for CAPI, retrying in the future`);
			return {
				action: PollingAction.RATE_LIMITED,
			};
		case 500: //concierge not happy. Re-post the incoming message, we need to keep looking.
		case 502:
		case 503:
		case 504:
			console.log(
				`WARNING CAPI returned ${response.status} indicating a remote fault. We will keep trying`,
			);
			return {
				action: PollingAction.CONCIERGE_UNHAPPY,
			};
		case 400: //we screwed up the request. This is a bug. DLQ the message and show an error.
			console.error(
				`CAPI returned ${response.status} indicating we sent an invalid request. Please fix the bug!`,
			);
			return {
				action: PollingAction.INTERNAL_BUG,
			};
		default: //whut?!
			console.error(`CAPI returned an unexpected response ${response.status}`);
			return {
				action: PollingAction.UNEXPECTED_RESPONSE,
			};
	}
}
