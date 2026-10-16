import { articlesPageSize, SectionSchema } from '@common/tool-models';
import type { Article } from '@common/tool-models';
import { extractProducts } from './products';
import {
	type CapiResult,
	type GetArticle,
	ItemResponseSchema,
	type ListArticles,
	type ListDrafts,
	SearchResponseSchema,
} from './types';

/** Each CAPI stage is fed by the Composer of the same stage, so their IDs match. */
export const getComposerBaseUrl = (stage: string) =>
	stage === 'PROD'
		? 'https://composer.gutools.co.uk'
		: 'https://composer.code.dev-gutools.co.uk';

// The fields of an article that the tool reads, and the body blocks its products are in.
// Preview CAPI is authorised by signing the request instead, so has no API key.
const articleQuery = (apiKey?: string) => ({
	'show-fields': 'internalComposerCode,byline,isLive,lastModified',
	// The body as structured elements, which the product links are read from.
	'show-blocks': 'body',
	...(apiKey && { 'api-key': apiKey }),
});

/**
 * How many of the most recently changed articles are searched for drafts. Preview CAPI
 * can't search for only drafts, so a draft that hasn't been changed since this many
 * others were is left out.
 */
export const draftsSearchSize = 100;

/** An article as the tool shows it, from CAPI's result for it. */
const toArticle = (
	{
		id,
		sectionId,
		webPublicationDate,
		webTitle,
		webUrl,
		fields,
		blocks,
	}: CapiResult,
	composerBaseUrl: string,
): Article => {
	const composerId = fields?.internalComposerCode;
	// Only Preview CAPI has drafts, and it says which are with isLive.
	const status = fields?.isLive === 'false' ? 'draft' : 'live';
	return {
		id,
		sectionId,
		status,
		webPublicationDate,
		lastModified: fields?.lastModified,
		webTitle,
		// Preview CAPI gives a draft the URL it will have, which doesn't work until it's published.
		webUrl: status === 'live' ? webUrl : undefined,
		// CAPI can send an empty byline.
		byline: fields?.byline?.trim() ? fields.byline : undefined,
		composerUrl: composerId
			? `${composerBaseUrl}/content/${composerId}`
			: undefined,
		ophanUrl: `https://dashboard.ophan.co.uk/info?capi-id=${encodeURIComponent(id)}`,
		products: extractProducts(blocks?.body ?? []),
	};
};

/**
 * Gets one article by its CAPI ID, from any section, so that an article can be found by
 * its URL. Undefined if CAPI has no content with that ID.
 */
export function createCapiArticle({
	baseUrl,
	apiKey,
	composerBaseUrl,
}: {
	baseUrl: string;
	apiKey: string;
	composerBaseUrl: string;
}): GetArticle {
	return async (path) => {
		const params = new URLSearchParams(articleQuery(apiKey));
		const response = await fetch(`${baseUrl}/${path}?${params.toString()}`);
		if (response.status === 404) {
			return undefined;
		}
		if (!response.ok) {
			// The URL isn't included, as it contains the API key.
			throw new Error(
				`CAPI lookup of ${path} failed with status ${response.status}`,
			);
		}
		const { content } = ItemResponseSchema.parse(
			await response.json(),
		).response;
		return toArticle(content, composerBaseUrl);
	};
}

/**
 * Lists articles from one or both Filter sections, newest first. Both sections are
 * searched in one query so that each page is ordered correctly across the two.
 */
export function createCapiArticles({
	baseUrl,
	apiKey,
	composerBaseUrl,
}: {
	baseUrl: string;
	apiKey: string;
	composerBaseUrl: string;
}): ListArticles {
	return async (page, section) => {
		const params = new URLSearchParams({
			section: section ?? SectionSchema.options.join('|'),
			'order-by': 'newest',
			'page-size': String(articlesPageSize),
			page: String(page),
			...articleQuery(apiKey),
		});
		const response = await fetch(`${baseUrl}/search?${params.toString()}`);
		if (!response.ok) {
			// The URL isn't included, as it contains the API key.
			throw new Error(
				`CAPI search for page ${page} failed with status ${response.status}`,
			);
		}

		// Throws if CAPI's response isn't the shape the tool relies on.
		const { currentPage, pages, total, results } = SearchResponseSchema.parse(
			await response.json(),
		).response;
		return {
			articles: results.map((result) => toArticle(result, composerBaseUrl)),
			currentPage,
			pages,
			total,
		};
	};
}

/**
 * Lists the drafts in one or both Filter sections from Preview CAPI, most recently changed
 * first, using a fetch that signs its requests for Preview CAPI.
 */
export function createCapiDrafts({
	baseUrl,
	composerBaseUrl,
	fetchPreview,
}: {
	baseUrl: string;
	composerBaseUrl: string;
	fetchPreview: (url: string) => Promise<Response>;
}): ListDrafts {
	return async (section) => {
		const params = new URLSearchParams({
			section: section ?? SectionSchema.options.join('|'),
			'order-by': 'newest',
			// Drafts have no publication date, so they're ordered by when they last changed.
			'use-date': 'last-modified',
			'page-size': String(draftsSearchSize),
			...articleQuery(),
		});
		const response = await fetchPreview(
			`${baseUrl}/search?${params.toString()}`,
		);
		if (!response.ok) {
			throw new Error(
				`Preview CAPI search for drafts failed with status ${response.status}`,
			);
		}
		const { results } = SearchResponseSchema.parse(
			await response.json(),
		).response;
		return results
			.map((result) => toArticle(result, composerBaseUrl))
			.filter((article) => article.status === 'draft');
	};
}
