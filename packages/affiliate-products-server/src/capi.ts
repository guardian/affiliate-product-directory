import { articlesPageSize, SectionSchema } from '@common/tool-models';
import type { Article } from '@common/tool-models';
import { bodyLinks, countLinks } from './linkCounts';
import { extractProducts } from './products';
import {
	type CapiResult,
	type GetArticle,
	type GetArticleLinks,
	ItemResponseSchema,
	type ListArticles,
	type ReadSkimlinksDomains,
	SearchResponseSchema,
} from './types';

/** Each CAPI stage is fed by the Composer of the same stage, so their IDs match. */
export const getComposerBaseUrl = (stage: string) =>
	stage === 'PROD'
		? 'https://composer.gutools.co.uk'
		: 'https://composer.code.dev-gutools.co.uk';

// The fields of an article that the tool reads, and the body blocks its products are in.
const articleQuery = (apiKey: string) => ({
	'show-fields': 'internalComposerCode,byline,isLive,lastModified',
	// The body as structured elements, which the product links are read from.
	'show-blocks': 'body',
	'api-key': apiKey,
});

/** Where the tool reads a stage's articles from. */
interface CapiOptions {
	baseUrl: string;
	apiKey: string;
	composerBaseUrl: string;
	readSkimlinksDomains: ReadSkimlinksDomains;
}

/**
 * An article as the tool shows it, from CAPI's result for it, with the links in its body
 * counted if the Skimlinks domains could be read.
 */
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
	skimlinksDomains: Set<string> | undefined,
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
		linkCounts:
			skimlinksDomains &&
			countLinks(bodyLinks(blocks?.body ?? []), skimlinksDomains),
	};
};

/** CAPI's result for one item by its CAPI ID, or undefined if CAPI has no content with that ID. */
const fetchItem = async (
	{ baseUrl, apiKey }: Pick<CapiOptions, 'baseUrl' | 'apiKey'>,
	path: string,
): Promise<CapiResult | undefined> => {
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
	return ItemResponseSchema.parse(await response.json()).response.content;
};

/**
 * Gets one article by its CAPI ID, from any section, so that an article can be found by
 * its URL. Undefined if CAPI has no content with that ID.
 */
export function createCapiArticle(options: CapiOptions): GetArticle {
	return async (path) => {
		const [content, skimlinksDomains] = await Promise.all([
			fetchItem(options, path),
			options.readSkimlinksDomains(),
		]);
		return (
			content && toArticle(content, options.composerBaseUrl, skimlinksDomains)
		);
	};
}

/**
 * Gets the links in one article's body by its CAPI ID. Undefined if CAPI has no content
 * with that ID.
 */
export function createCapiArticleLinks(
	options: Pick<CapiOptions, 'baseUrl' | 'apiKey'>,
): GetArticleLinks {
	return async (path) => {
		const content = await fetchItem(options, path);
		return (
			content && {
				webUrl: content.webUrl,
				webTitle: content.webTitle,
				links: bodyLinks(content.blocks?.body ?? []),
			}
		);
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
	readSkimlinksDomains,
}: CapiOptions): ListArticles {
	return async (page, section) => {
		const params = new URLSearchParams({
			section: section ?? SectionSchema.options.join('|'),
			'order-by': 'newest',
			'page-size': String(articlesPageSize),
			page: String(page),
			...articleQuery(apiKey),
		});
		const [response, skimlinksDomains] = await Promise.all([
			fetch(`${baseUrl}/search?${params.toString()}`),
			readSkimlinksDomains(),
		]);
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
			articles: results.map((result) =>
				toArticle(result, composerBaseUrl, skimlinksDomains),
			),
			currentPage,
			pages,
			total,
		};
	};
}
