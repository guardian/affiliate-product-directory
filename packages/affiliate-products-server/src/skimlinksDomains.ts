import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ReadSkimlinksDomains } from './types';

// The merchants Skimlinks supports, written each day by skimlinks-lambda. frontend reads
// the same file to decide which links in an article to send through Skimlinks.
const bucket = 'gu-skimlinks-store';
const key = 'skimlinks/skimlinks-domains.csv';

const cacheMs = 60 * 60 * 1000;

/** The domains in the file, which is one line of them separated by commas. */
export const parseSkimlinksDomains = (csv: string): Set<string> =>
	new Set(
		csv
			.split(',')
			.map((domain) => domain.trim().toLowerCase())
			.filter((domain) => domain !== ''),
	);

/**
 * Reads the Skimlinks domains from S3, keeping them for an hour, as the file only changes
 * once a day. Undefined if they can't be read, which is tried again on the next request.
 */
export const createSkimlinksDomains = (
	s3Client = new S3Client({ region: 'eu-west-1' }),
	now = Date.now,
): ReadSkimlinksDomains => {
	let cached: { domains: Set<string>; readAt: number } | undefined;

	return async () => {
		if (cached && now() - cached.readAt < cacheMs) {
			return cached.domains;
		}
		try {
			const response = await s3Client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key }),
			);
			const domains = parseSkimlinksDomains(
				(await response.Body?.transformToString()) ?? '',
			);
			if (domains.size === 0) {
				throw new Error(`s3://${bucket}/${key} has no domains`);
			}
			cached = { domains, readAt: now() };
			return domains;
		} catch (error) {
			console.error(error);
			// Older domains are better than none.
			return cached?.domains;
		}
	};
};
