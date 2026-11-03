import type { Article } from '@common/tool-models';
import { useEffect, useState } from 'react';
import { fetchArticles } from '../api/articles';

// How many starred articles are looked up at once, so that restoring a long list doesn't
// send them all together.
const batchSize = 5;

interface Loaded {
	/** The data and list fetch the articles are from, so a change of either fetches them again. */
	prod: boolean;
	reloads: number;
	articles: Map<string, Article>;
	/** The IDs whose lookup failed last time, which are tried again on a retry. */
	failed: Set<string>;
}

/** Looks up starred articles, a few at a time, as each can be on any page. */
const lookUp = async (
	ids: string[],
	prod: boolean,
	signal: AbortSignal,
): Promise<{ found: Article[]; failed: string[] }> => {
	const found: Article[] = [];
	const failed: string[] = [];
	for (let start = 0; start < ids.length; start += batchSize) {
		const batch = ids.slice(start, start + batchSize);
		const results = await Promise.all(
			batch.map((id) =>
				fetchArticles(
					{
						page: 1,
						section: undefined,
						status: undefined,
						livePricing: false,
						prod,
						path: id,
					},
					signal,
				).catch(() => undefined),
			),
		);
		results.forEach((result, index) => {
			const article =
				result?.status === 'loaded' ? result.page.articles[0] : undefined;
			if (article) {
				found.push(article);
			} else if (result?.status !== 'loaded') {
				// An article that's gone isn't a failure: there's just nothing to pin.
				failed.push(batch[index] ?? '');
			}
		});
	}
	return { found, failed };
};

/**
 * The starred articles, by ID. Only those not already loaded are looked up when the stars
 * change; all of them are looked up again when the data changes or a price is set.
 * Undefined until the first lookup for the data being shown is done.
 */
export const useStarredArticles = (
	starred: string[],
	prod: boolean,
	reloads: number,
) => {
	const [loaded, setLoaded] = useState<Loaded>();
	const [retries, setRetries] = useState(0);

	useEffect(() => {
		const current = loaded?.prod === prod && loaded.reloads === reloads;
		const missing = current
			? starred.filter((id) => !loaded.articles.has(id))
			: starred;
		if (current && missing.length === 0) {
			return;
		}
		const controller = new AbortController();
		void lookUp(missing, prod, controller.signal).then(({ found, failed }) => {
			if (controller.signal.aborted) {
				return;
			}
			setLoaded((previous) => {
				const kept =
					previous?.prod === prod
						? previous.articles
						: new Map<string, Article>();
				// A failed lookup keeps the article as it was last loaded, if it was.
				const articles = new Map(
					current ? kept : [...kept].filter(([id]) => failed.includes(id)),
				);
				for (const article of found) {
					articles.set(article.id, article);
				}
				return { prod, reloads, articles, failed: new Set(failed) };
			});
		});
		return () => controller.abort();
		// loaded is read only to see what's missing, so its own changes don't look up again.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see above
	}, [starred, prod, reloads, retries]);

	const articles = loaded?.prod === prod ? loaded.articles : undefined;
	return {
		articles,
		/** The starred articles that couldn't be looked up. */
		failed:
			loaded?.prod === prod
				? starred.filter(
						(id) => loaded.failed.has(id) && !loaded.articles.has(id),
					)
				: [],
		retry: () => setRetries((n) => n + 1),
	};
};
