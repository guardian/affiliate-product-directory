import { ArticleStatusSchema, SectionSchema } from '@common/tool-models';
import type { ArticleStatus, Section } from '@common/tool-models';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { ListParams } from '../types';

// Anything missing or invalid falls back to its default, so a mistyped link still opens the list.
const ListParamsSchema = z.object({
	page: z
		.string()
		.regex(/^[1-9]\d*$/)
		.transform(Number)
		.catch(1),
	section: SectionSchema.optional().catch(undefined),
	status: ArticleStatusSchema.optional().catch(undefined),
	livePricing: z
		.literal('true')
		.transform(() => true)
		.catch(false),
	prod: z
		.literal('true')
		.transform(() => true)
		.catch(false),
	// Kept as it was typed or pasted; the server reads the article's ID from it.
	path: z.string().trim().min(1).optional().catch(undefined),
});

/** Reads the list's params from a URL's query string, such as `?page=2&section=thefilter-us&status=live&livePricing=true&prod=true`. */
export const parseListParams = (search: string): ListParams => {
	const params = new URLSearchParams(search);
	const { page, section, status, livePricing, prod, path } =
		ListParamsSchema.parse({
			page: params.get('page') ?? undefined,
			section: params.get('section') ?? undefined,
			status: params.get('status') ?? undefined,
			livePricing: params.get('livePricing') ?? undefined,
			prod: params.get('prod') ?? undefined,
			path: params.get('path') ?? undefined,
		});
	return { page, section, status, livePricing, prod, path };
};

/** The query string for the list's params. Defaults are left out, so the first page of every section of the stage's own data is ''. */
export const formatListParams = ({
	page,
	section,
	status,
	livePricing,
	prod,
	path,
}: ListParams): string => {
	const params = new URLSearchParams();
	if (page > 1) {
		params.set('page', String(page));
	}
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
	const search = params.toString();
	return search ? `?${search}` : '';
};

/**
 * Keeps the list's page, section, status, live pricing and data in the URL, so that the address bar always links to
 * what's on screen and can be shared.
 */
export const useListParams = () => {
	const [params, setParams] = useState(() =>
		parseListParams(window.location.search),
	);

	useEffect(() => {
		// Back and Forward change the URL without going through navigate.
		const onPopState = () => setParams(parseListParams(window.location.search));
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	}, []);

	const navigate = (next: ListParams) => {
		if (
			next.page === params.page &&
			next.section === params.section &&
			next.status === params.status &&
			next.livePricing === params.livePricing &&
			next.prod === params.prod &&
			next.path === params.path
		) {
			return;
		}
		// Each change is a history entry, so Back returns to the previous view.
		window.history.pushState(
			null,
			'',
			`${window.location.pathname}${formatListParams(next)}`,
		);
		setParams(next);
	};

	return {
		...params,
		setPage: (page: number) => navigate({ ...params, page }),
		// Another section is a different list, so it starts from its first page, and leaves
		// a search for one article.
		setSection: (section: Section | undefined) =>
			navigate({ ...params, page: 1, section, path: undefined }),
		// As is just drafts or just live articles.
		setStatus: (status: ArticleStatus | undefined) =>
			navigate({ ...params, page: 1, status, path: undefined }),
		// As is just the articles with live pricing.
		setLivePricing: (livePricing: boolean) =>
			navigate({ ...params, page: 1, livePricing, path: undefined }),
		// So is another stage's data, though a search for one article looks for it there too.
		setProd: (prod: boolean) => navigate({ ...params, page: 1, prod }),
		// Shows just the article at a URL or path, or the list again when undefined.
		setPath: (path: string | undefined) =>
			navigate({ ...params, page: 1, path }),
	};
};
