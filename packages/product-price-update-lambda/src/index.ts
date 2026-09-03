import type { EventBridgeEvent } from 'aws-lambda';
import { getConfig } from '../../common/src/config';

type DetailType = Record<string, unknown>; // replace with your actual event detail shape

export const eventHandler = (event: EventBridgeEvent<string, DetailType>) => {
	const { stage, app } = getConfig();

	console.log(
		`Received event in ${app} (${stage}): ${event['detail-type']}`,
		JSON.stringify(event.detail),
	);

	try {
		// ...handler logic goes here
		return;
	} catch (error) {
		console.error('Error handling event', error);
		throw error; // rethrow so Lambda/EventBridge records the failure
	}
};
