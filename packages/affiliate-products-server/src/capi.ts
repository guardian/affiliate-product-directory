import { articlesPageSize, SectionSchema } from '@common/tool-models';
import type { Article, Section } from '@common/tool-models';
import { bodyLinks, countLinks, linkKind } from './linkCounts';
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
	'show-fields':
		'internalComposerCode,byline,isLive,lastModified,livePricingEnabled',
	// The body as structured elements, which the product links are read from.
	'show-blocks': 'body',
	'api-key': apiKey,
});

/** Where the tool reads a stage's articles from. */
interface CapiOptions {
	baseUrl: string;
	apiKey: string;
	composerBaseUrl: string;
	/** The CAPI IDs of the articles that frontend's own list gives live pricing to in this stage. */
	livePricingIds: Set<string>;
	readSkimlinksDomains: ReadSkimlinksDomains;
}

/** Whether Composer has set CAPI's result to show live prices. */
const isLivePricingEnabled = ({ fields }: CapiResult) =>
	String(fields?.livePricingEnabled) === 'true';

/** Whether CAPI's result is set to show live prices, by its field or frontend's list. */
const hasLivePricing = (result: CapiResult, livePricingIds: Set<string>) =>
	isLivePricingEnabled(result) || livePricingIds.has(result.id);

/**
 * An article as the tool shows it, from CAPI's result for it, with the links in its body
 * counted if the Skimlinks domains could be read.
 */
const toArticle = (
	result: CapiResult,
	{ composerBaseUrl, livePricingIds }: CapiOptions,
	skimlinksDomains: Set<string> | undefined,
): Article => {
	const {
		id,
		sectionId,
		webPublicationDate,
		webTitle,
		webUrl,
		fields,
		blocks,
	} = result;
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
		livePricing: hasLivePricing(result, livePricingIds),
		composerUrl: composerId
			? `${composerBaseUrl}/content/${composerId}`
			: undefined,
		ophanUrl: `https://dashboard.ophan.co.uk/info?capi-id=${encodeURIComponent(id)}`,
		products: extractProducts(blocks?.body ?? []).map((product) => ({
			...product,
			links: product.links.map((link) => ({
				...link,
				kind: skimlinksDomains && linkKind(link.url, skimlinksDomains),
			})),
		})),
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
		return content && toArticle(content, options, skimlinksDomains);
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

/** Searches CAPI, and throws if it fails or its response isn't the shape the tool relies on. */
const searchCapi = async (
	baseUrl: string,
	params: Record<string, string>,
	description: string,
) => {
	const response = await fetch(
		`${baseUrl}/search?${new URLSearchParams(params).toString()}`,
	);
	if (!response.ok) {
		// The URL isn't included, as it contains the API key.
		throw new Error(`${description} failed with status ${response.status}`);
	}
	return SearchResponseSchema.parse(await response.json()).response;
};

// CAPI's largest page, so that every article can be checked for live pricing in few requests.
const scanPageSize = 200;

// How long the articles found with live pricing are kept, so that paging through them, or
// coming back to them, doesn't search every article again.
const livePricingCacheMs = 5 * 60 * 1000;

/**
 * Lists the CAPI IDs of the articles in one or both Filter sections with live pricing.
 * CAPI can't search by the livePricingEnabled field, so every article's field is read,
 * without its body, and the ones frontend's list names are added.
 */
const createLivePricingIds = ({
	baseUrl,
	apiKey,
	livePricingIds,
}: CapiOptions) => {
	const cache = new Map<string, { ids: string[]; expiresAt: number }>();

	return async (section?: Section): Promise<string[]> => {
		const key = section ?? '';
		const cached = cache.get(key);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.ids;
		}

		const scanPage = (page: number) =>
			searchCapi(
				baseUrl,
				{
					section: section ?? SectionSchema.options.join('|'),
					'order-by': 'newest',
					'page-size': String(scanPageSize),
					page: String(page),
					'show-fields': 'livePricingEnabled',
					'api-key': apiKey,
				},
				`CAPI search for live pricing, page ${page}`,
			);
		const first = await scanPage(1);
		const rest = await Promise.all(
			Array.from({ length: first.pages - 1 }, (_, i) => scanPage(i + 2)),
		);
		const flagged = [first, ...rest]
			.flatMap(({ results }) => results)
			.filter(isLivePricingEnabled)
			.map(({ id }) => id);
		const listed = [...livePricingIds].filter(
			(id) => !section || id.startsWith(`${section}/`),
		);
		const ids = [...new Set([...flagged, ...listed])];

		cache.set(key, { ids, expiresAt: Date.now() + livePricingCacheMs });
		return ids;
	};
};

/**
 * Lists articles from one or both Filter sections, newest first, or just those with live
 * pricing. Both sections are searched in one query so that each page is ordered correctly
 * across the two.
 */
export function createCapiArticles(options: CapiOptions): ListArticles {
	const { baseUrl, apiKey, readSkimlinksDomains } = options;
	const listLivePricingIds = createLivePricingIds(options);

	return async (page, section, onlyLivePricing = false) => {
		const ids = onlyLivePricing ? await listLivePricingIds(section) : [];
		if (onlyLivePricing && ids.length === 0) {
			return { articles: [], currentPage: 1, pages: 0, total: 0 };
		}
		const params = {
			// Just the articles with live pricing, which are already only from the section.
			...(onlyLivePricing
				? { ids: ids.join(',') }
				: { section: section ?? SectionSchema.options.join('|') }),
			'order-by': 'newest',
			'page-size': String(articlesPageSize),
			page: String(page),
			...articleQuery(apiKey),
		};
		const [{ currentPage, pages, total, results }, skimlinksDomains] =
			await Promise.all([
				searchCapi(baseUrl, params, `CAPI search for page ${page}`),
				readSkimlinksDomains(),
			]);
		return {
			articles: results.map((result) =>
				toArticle(result, options, skimlinksDomains),
			),
			currentPage,
			pages,
			total,
		};
	};
}
