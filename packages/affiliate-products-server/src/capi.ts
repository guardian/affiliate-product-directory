import { articlesPageSize, SectionSchema } from '@common/tool-models';
import { extractProductLinks } from './products';
import { type ListArticles, SearchResponseSchema } from './types';

/** Each CAPI stage is fed by the Composer of the same stage, so their IDs match. */
export const getComposerBaseUrl = (stage: string) =>
	stage === 'PROD'
		? 'https://composer.gutools.co.uk'
		: 'https://composer.code.dev-gutools.co.uk';

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
			'show-fields': 'internalComposerCode',
			// The body as structured elements, which the product links are read from.
			'show-blocks': 'body',
			'api-key': apiKey,
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
			articles: results.map(
				({
					id,
					sectionId,
					webPublicationDate,
					webTitle,
					webUrl,
					fields,
					blocks,
				}) => {
					const composerId = fields?.internalComposerCode;
					return {
						id,
						sectionId,
						webPublicationDate,
						webTitle,
						webUrl,
						composerUrl: composerId
							? `${composerBaseUrl}/content/${composerId}`
							: undefined,
						ophanUrl: `https://dashboard.ophan.co.uk/info?capi-id=${encodeURIComponent(id)}`,
						products: extractProductLinks(blocks?.body ?? []),
					};
				},
			),
			currentPage,
			pages,
			total,
		};
	};
}
