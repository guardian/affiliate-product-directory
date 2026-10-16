import { type LinkCounts, LinkCountsSchema } from '@common/tool-models';

/**
 * Counts the links on an article as it's rendered on the site, as the Affiliate Link
 * Counter bookmarklet does. Undefined if the page couldn't be read.
 */
export const fetchLinkCounts = async (
	webUrl: string,
	signal: AbortSignal,
): Promise<LinkCounts | undefined> => {
	const params = new URLSearchParams({ url: webUrl });
	const response = await fetch(`/api/link-counts?${params.toString()}`, {
		signal,
	});
	if (!response.ok) {
		return undefined;
	}
	const counts = LinkCountsSchema.safeParse(await response.json());
	if (!counts.success) {
		console.error('Unexpected response from /api/link-counts', counts.error);
		return undefined;
	}
	return counts.data;
};
