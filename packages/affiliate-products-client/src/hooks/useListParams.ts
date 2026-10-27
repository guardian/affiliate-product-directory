import { SectionSchema } from '@common/tool-models';
import type { Section } from '@common/tool-models';
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
	prod: z
		.literal('true')
		.transform(() => true)
		.catch(false),
});

/** Reads the list's params from a URL's query string, such as `?page=2&section=thefilter-us&prod=true`. */
export const parseListParams = (search: string): ListParams => {
	const params = new URLSearchParams(search);
	const { page, section, prod } = ListParamsSchema.parse({
		page: params.get('page') ?? undefined,
		section: params.get('section') ?? undefined,
		prod: params.get('prod') ?? undefined,
	});
	return { page, section, prod };
};

/** The query string for the list's params. Defaults are left out, so the first page of every section of the stage's own data is ''. */
export const formatListParams = ({
	page,
	section,
	prod,
}: ListParams): string => {
	const params = new URLSearchParams();
	if (page > 1) {
		params.set('page', String(page));
	}
	if (section) {
		params.set('section', section);
	}
	if (prod) {
		params.set('prod', 'true');
	}
	const search = params.toString();
	return search ? `?${search}` : '';
};

/**
 * Keeps the list's page, section and data in the URL, so that the address bar always links to
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
			next.prod === params.prod
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
		// Another section is a different list, so it starts from its first page.
		setSection: (section: Section | undefined) =>
			navigate({ ...params, page: 1, section }),
		// So is another stage's data.
		setProd: (prod: boolean) => navigate({ ...params, page: 1, prod }),
	};
};
