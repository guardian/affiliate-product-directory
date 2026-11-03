import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const cacheMs = 60 * 1000;

/**
 * Reads the switch for setting PROD's prices by hand from another stage: an SSM parameter
 * that is on when it's `true`. It's kept for a minute, so flipping it takes effect within
 * one. Off if the parameter is missing or can't be read.
 */
export const createProdPriceEditingSwitch = (
	parameterName: string,
	ssmClient = new SSMClient({ region: 'eu-west-1' }),
	now = Date.now,
): (() => Promise<boolean>) => {
	let cached: { enabled: boolean; readAt: number } | undefined;

	return async () => {
		if (cached && now() - cached.readAt < cacheMs) {
			return cached.enabled;
		}
		let enabled = false;
		try {
			const response = await ssmClient.send(
				new GetParameterCommand({ Name: parameterName }),
			);
			enabled = response.Parameter?.Value?.trim().toLowerCase() === 'true';
		} catch (error) {
			if (!(error instanceof Error && error.name === 'ParameterNotFound')) {
				console.error(error);
			}
		}
		cached = { enabled, readAt: now() };
		return enabled;
	};
};
