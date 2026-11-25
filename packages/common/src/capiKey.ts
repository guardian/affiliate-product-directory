import { getConfig } from '@common/config';
import { appName } from '@common/constants';
import { getParametersFromParameterStore } from '@common/parameterStore';

// Cached at module scope so a warm Lambda reads the key from Parameter Store once.
let cachedCapiKey: Promise<string> | undefined;

/** The stage's CAPI key, read from Parameter Store rather than the environment. */
export function getCapiKey(): Promise<string> {
	if (!cachedCapiKey) {
		const { stage, stack } = getConfig();
		const name = `/${stage}/${stack}/${appName}/capi-key`;
		cachedCapiKey = getParametersFromParameterStore([name]).then(
			(parameters) => parameters[name]!,
		);
		// Not kept if the read fails, so the next call tries again.
		cachedCapiKey.catch(() => {
			cachedCapiKey = undefined;
		});
	}
	return cachedCapiKey;
}
