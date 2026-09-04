import { getConfig } from '../../../../common/src/config';
import { appName } from '../../../../common/src/constants';
import { getParametersFromParameterStore } from '../../../../common/src/parameterStore';
import type { Region } from '../../models';

const config = getConfig();
const commonPath = `/${config.stage}/${config.stack}/${appName}/skimlinks`;
const publisherIdKey = `${commonPath}/publisherId`;
const clientIdKey = `${commonPath}/products/clientId`;
const clientSecretKey = `${commonPath}/products/clientSecret`;
const ukPublisherDomainIdKey = `${commonPath}/products/publisherDomainId/UK`;
const usPublisherDomainIdKey = `${commonPath}/products/publisherDomainId/US`;

export interface SkimlinksCredentials {
	publisherId: string;
	clientId: string;
	clientSecret: string;
	publisherDomainId: Record<Region, string>;
}

// Cached at module scope so a warm Lambda reuses them across invocations.
let cachedCredentials: SkimlinksCredentials | undefined;
let cachedAccessToken: string | undefined;

export async function getSkimlinksCredentials(): Promise<SkimlinksCredentials> {
	if (cachedCredentials) {
		return cachedCredentials;
	}

	const parameters = await getParametersFromParameterStore([
		publisherIdKey,
		clientIdKey,
		clientSecretKey,
		ukPublisherDomainIdKey,
		usPublisherDomainIdKey,
	]);

	cachedCredentials = {
		publisherId: parameters[publisherIdKey]!,
		clientId: parameters[clientIdKey]!,
		clientSecret: parameters[clientSecretKey]!,
		publisherDomainId: {
			UK: parameters[ukPublisherDomainIdKey]!,
			US: parameters[usPublisherDomainIdKey]!,
		},
	};

	return cachedCredentials;
}

export async function getSkimlinksAccessToken(): Promise<string> {
	if (cachedAccessToken) {
		return cachedAccessToken;
	}

	const credentials = await getSkimlinksCredentials();
	const resp = await fetch('https://authentication.skimapis.com/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			client_id: credentials.clientId,
			client_secret: credentials.clientSecret,
			grant_type: 'client_credentials',
		}),
	});

	if (!resp.ok) {
		console.log(JSON.stringify(await resp.json(), null, 2));
		throw new Error('Failed to fetch Skimlinks credentials');
	}

	const data = (await resp.json()) as Partial<{
		access_token: string;
		expiry_timestamp: number;
		timestamp: number;
	}>;

	if (!data.access_token) {
		throw new Error('access_token missing from Skimlinks response');
	}

	cachedAccessToken = data.access_token;
	return cachedAccessToken;
}
