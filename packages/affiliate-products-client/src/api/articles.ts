import { ArticlesPageSchema } from '@common/tool-models';
import type { Section } from '@common/tool-models';
import type { ArticlesState } from '../types';

/** Fetches a page of articles from one section, or from both if none is given. */
export const fetchArticles = async (
	page: number,
	section: Section | undefined,
	signal: AbortSignal,
): Promise<ArticlesState> => {
	const params = new URLSearchParams({ page: String(page) });
	if (section) {
		params.set('section', section);
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
