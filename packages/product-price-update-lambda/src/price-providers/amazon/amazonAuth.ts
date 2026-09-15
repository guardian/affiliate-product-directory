import { getConfig } from '@common/config';
import { appName } from '@common/constants';
import { getParametersFromParameterStore } from '@common/parameterStore';
import type { Region } from '@price-update/models';

const config = getConfig();
const commonPath = `/${config.stage}/${config.stack}/${appName}/amazon`;
const ukClientIdKey = `${commonPath}/products/clientId/UK`;
const usClientIdKey = `${commonPath}/products/clientId/US`;
const ukClientSecretKey = `${commonPath}/products/clientSecret/UK`;
const usClientSecretKey = `${commonPath}/products/clientSecret/US`;
const ukPartnerTagKey = `${commonPath}/products/partnerTag/UK`;
const usPartnerTagKey = `${commonPath}/products/partnerTag/US`;

export interface AmazonCredentials {
	clientId: Record<Region, string>;
	clientSecret: Record<Region, string>;
	partnerTag: Record<Region, string>;
}

const TOKEN_ENDPOINT: Record<Region, string> = {
	UK: 'https://api.amazon.co.uk/auth/o2/token',
	US: 'https://api.amazon.com/auth/o2/token',
};

// Cached at module scope so a warm Lambda reuses them across invocations.
let cachedCredentials: AmazonCredentials | undefined;
const tokenCache: Partial<Record<Region, string>> = {};

export async function getAmazonCredentials(): Promise<AmazonCredentials> {
	if (cachedCredentials) {
		return cachedCredentials;
	}

	const parameters = await getParametersFromParameterStore([
		ukClientIdKey,
		usClientIdKey,
		ukClientSecretKey,
		usClientSecretKey,
		ukPartnerTagKey,
		usPartnerTagKey,
	]);

	cachedCredentials = {
		clientId: {
			UK: parameters[ukClientIdKey]!,
			US: parameters[usClientIdKey]!,
		},
		clientSecret: {
			UK: parameters[ukClientSecretKey]!,
			US: parameters[usClientSecretKey]!,
		},
		partnerTag: {
			UK: parameters[ukPartnerTagKey]!,
			US: parameters[usPartnerTagKey]!,
		},
	};

	return cachedCredentials;
}

export async function getAmazonAccessToken(region: Region): Promise<string> {
	const cached = tokenCache[region];
	if (cached) {
		return cached;
	}

	const credentials = await getAmazonCredentials();
	const resp = await fetch(TOKEN_ENDPOINT[region], {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: credentials.clientId[region],
			client_secret: credentials.clientSecret[region],
			scope: 'creatorsapi::default',
		}),
	});

	if (!resp.ok) {
		console.log(JSON.stringify(await resp.json(), null, 2));
		throw new Error('Failed to fetch Amazon credentials');
	}

	const data = (await resp.json()) as Partial<{
		access_token: string;
		expires_in: number;
	}>;

	if (!data.access_token) {
		throw new Error('access_token missing from Amazon response');
	}

	const accessToken = data.access_token;
	tokenCache[region] = accessToken;

	return accessToken;
}
