import { ContentType } from '@guardian/content-api-models/v1/contentType';
import type { PollingResult } from './capi';
import { callCAPI, PollingAction } from './capi';
import { handleContentUpdate } from './update-processor';

async function retrieveContent(capiUrl: string): Promise<PollingResult> {
	const params = [
		`show-fields=internalRevision,lastModifiedDate,firstPublishedDate,publishedDate`,
		`show-blocks=all`,
		`show-channels=all`,
		`show-tags=all`,
		`format=thrift`,
	]
		.filter((v) => !!v)
		.join('&');

	return callCAPI(`${capiUrl}?${params}`);
}

export async function handleContentUpdateByCapiUrl({
	contentType,
	capiUrl,
	internalRevision,
}: {
	contentType?: ContentType;
	capiUrl: string;
	internalRevision?: number;
}): Promise<number> {
	if (contentType != ContentType.ARTICLE) {
		return 0;
	} //no point processing live-blogs etc.
	const capiResponse = await retrieveContent(capiUrl);

	switch (capiResponse.action) {
		case PollingAction.CONTENT_EXISTS:
			//Great, we have it - but should check if this has now been superceded
			if (
				capiResponse.content?.fields?.internalRevision &&
				internalRevision &&
				capiResponse.content.fields.internalRevision > internalRevision
			) {
				console.log(
					`INFO Retrievable update for ${capiUrl} was superceded - we expected to see ${internalRevision} but got ${capiResponse.content.fields.internalRevision}`,
				);
			} else if (capiResponse.content) {
				return handleContentUpdate({
					content: capiResponse.content,
				});
			} else {
				console.error(
					`Content for ${capiUrl} existed but was empty, this shouldn't happen :(`,
				);
			}
			return 0;
		case PollingAction.CONTENT_GONE:
		case PollingAction.CONTENT_MISSING:
			console.log(
				`INFO Content for ${capiUrl} has gone for this update, assuming that this article was taken down in the meantime.`,
			);
			return 0;
		default:
			// ToDo: should we implement a DLQ?
			//we throw an exception to indicate failure; the lambda runtime will then re-run us and DLQ the message if enough failures happen.
			throw new Error(
				`Could not handle retrievable update from CAPI: PollingAction code was ${capiResponse.action.toString()}. Allowing the lambda runtime to retry or DLQ.`,
			);
	}
}
