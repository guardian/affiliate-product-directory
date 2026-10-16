import { createHash, createHmac, type Hash, type Hmac } from 'crypto';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import type { SourceData } from '@smithy/types';

// Preview CAPI is behind API Gateway in eu-west-1, which checks each request's signature.
const region = 'eu-west-1';
const service = 'execute-api';

const toBytes = (data: SourceData) =>
	typeof data === 'string'
		? data
		: ArrayBuffer.isView(data)
			? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			: new Uint8Array(data);

/** SHA-256, or HMAC-SHA-256 given a secret, in the shape the signer hashes with. */
class Sha256 {
	private hash: Hash | Hmac;
	private readonly secret?: string | Uint8Array;

	constructor(secret?: SourceData) {
		this.secret = secret === undefined ? undefined : toBytes(secret);
		this.hash = this.create();
	}

	private create() {
		return this.secret === undefined
			? createHash('sha256')
			: createHmac('sha256', this.secret);
	}

	update(data: SourceData) {
		this.hash.update(toBytes(data));
	}

	digest() {
		return Promise.resolve(new Uint8Array(this.hash.digest()));
	}

	reset() {
		this.hash = this.create();
	}
}

/**
 * A fetch for Preview CAPI, which signs each request with the role the CAPI team gives
 * access to Preview CAPI with. The role's credentials are refreshed as they expire.
 */
export const createPreviewFetch = (roleArn: string) => {
	const signer = new SignatureV4({
		credentials: fromTemporaryCredentials({
			params: { RoleArn: roleArn, RoleSessionName: 'affiliate-products-tool' },
		}),
		region,
		service,
		sha256: Sha256,
	});

	return async (url: string): Promise<Response> => {
		const { hostname, pathname, searchParams } = new URL(url);
		const signed = await signer.sign({
			method: 'GET',
			protocol: 'https:',
			hostname,
			path: pathname,
			query: Object.fromEntries(searchParams),
			headers: { host: hostname },
		});
		return fetch(url, { headers: signed.headers });
	};
};
