import { ArticlesPageSchema } from '@common/tool-models';
import type { ArticlesState, ListParams } from '../types';

/**
 * Fetches a page of articles from one section, or from both if none is given, from PROD if
 * asked. The first page has the drafts too, unless just live articles are asked for.
 */
export const fetchArticles = async (
	{ page, section, status, livePricing, prod, path }: ListParams,
	signal: AbortSignal,
): Promise<ArticlesState> => {
	const params = new URLSearchParams({ page: String(page) });
	if (section) {
		params.set('section', section);
	}
	if (status) {
		params.set('status', status);
	}
	if (livePricing) {
		params.set('livePricing', 'true');
	}
	if (prod) {
		params.set('prod', 'true');
	}
	if (path) {
		params.set('path', path);
	}
	const response = await fetch(`/api/articles?${params.toString()}`, {
		signal,
	});
	if (response.status === 401) {
		return { status: 'unauthenticated' };
	}
	if (!response.ok) {
		return { status: 'error' };
	}

	const articlesPage = ArticlesPageSchema.safeParse(await response.json());
	if (!articlesPage.success) {
		console.error('Unexpected response from /api/articles', articlesPage.error);
		return { status: 'error' };
	}
	return { status: 'loaded', page: articlesPage.data };
};
