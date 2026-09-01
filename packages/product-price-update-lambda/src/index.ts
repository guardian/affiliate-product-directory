import type { EventBridgeEvent, Context } from 'aws-lambda';
import { getConfig } from './config';

type DetailType = Record<string, unknown>; // replace with your actual event detail shape

export const eventHandler = async (
	event: EventBridgeEvent<string, DetailType>,
	context: Context,
) => {
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
