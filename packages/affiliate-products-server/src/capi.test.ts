import { ArticlesPageSchema } from '@common/tool-models';
import { jest } from '@jest/globals';
import {
	createCapiArticle,
	createCapiArticleLinks,
	createCapiArticles,
	getComposerBaseUrl,
} from './capi';

// The Skimlinks domains, read every time.
const readSkimlinksDomains = () => Promise.resolve(new Set(['johnlewis.com']));

const result = {
	id: 'thefilter-us/2026/oct/12/protein-powder-faq-dietitians',
	type: 'article',
	sectionId: 'thefilter-us',
	sectionName: 'The Filter US',
	webPublicationDate: '2026-10-12T14:15:57Z',
	webTitle: 'Can I get too much protein?',
	webUrl:
		'https://www.theguardian.com/thefilter-us/2026/oct/12/protein-powder-faq-dietitians',
	apiUrl:
		'https://content.guardianapis.com/thefilter-us/2026/oct/12/protein-powder-faq-dietitians',
	fields: {
		internalComposerCode: '6707d2a08f08a1b2c3d4e5f6',
		byline: 'Jane Doe',
	},
	blocks: {
		body: [
			{
				id: 'block-1',
				bodyHtml: '<p>Some text</p>',
				elements: [
					{ type: 'text', assets: [], textTypeData: { html: '<p>Text</p>' } },
					{
						type: 'link',
						assets: [],
						linkTypeData: {
							url: 'https://www.amazon.com/dp/B0F1ZV7PWW',
							label: '$20 for 10 servings at Amazon',
							linkType: 'product-button',
							priority: 'primary',
						},
					},
				],
			},
		],
		totalBodyBlocks: 1,
	},
	isHosted: false,
};

const searchResponse = {
	response: {
		status: 'ok',
		total: 250,
		startIndex: 26,
		pageSize: 25,
		currentPage: 2,
		pages: 10,
		orderBy: 'newest',
		results: [result],
	},
};

describe('createCapiArticles', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const stubFetch = (response: Response) =>
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);

	const listArticles = createCapiArticles({
		baseUrl: 'https://capi.example.com',
		apiKey: 'test-key',
		composerBaseUrl: 'https://composer.example.com',
		readSkimlinksDomains,
	});

	it.each(['thefilter', 'thefilter-us'] as const)(
		'searches only the %s section when given',
		async (section) => {
			const fetch = stubFetch(Response.json(searchResponse));

			await listArticles(1, section);

			const url = new URL(fetch.mock.calls[0]?.[0] as string);
			expect(url.searchParams.get('section')).toBe(section);
		},
	);

	it('searches both Filter sections, newest first, for the requested page', async () => {
		const fetch = stubFetch(Response.json(searchResponse));

		await listArticles(2);

		const url = new URL(fetch.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe('https://capi.example.com/search');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			section: 'thefilter|thefilter-us',
			'order-by': 'newest',
			'page-size': '25',
			page: '2',
			'show-fields':
				'internalComposerCode,byline,isLive,lastModified,livePricingEnabled',
			'show-blocks': 'body',
			'api-key': 'test-key',
		});
	});

	it('returns only the fields the tool needs, with the paging details', async () => {
		stubFetch(Response.json(searchResponse));

		expect(await listArticles(2)).toEqual({
			articles: [
				{
					id: result.id,
					sectionId: result.sectionId,
					status: 'live',
					webPublicationDate: result.webPublicationDate,
					webTitle: result.webTitle,
					webUrl: result.webUrl,
					byline: 'Jane Doe',
					livePricing: false,
					composerUrl:
						'https://composer.example.com/content/6707d2a08f08a1b2c3d4e5f6',
					ophanUrl:
						'https://dashboard.ophan.co.uk/info?capi-id=thefilter-us%2F2026%2Foct%2F12%2Fprotein-powder-faq-dietitians',
					products: [
						{
							links: [
								{
									url: 'https://www.amazon.com/dp/B0F1ZV7PWW',
									label: '$20 for 10 servings at Amazon',
									retailer: 'Amazon',
									basePrice: { currencySymbol: '$', amount: 20 },
									kind: 'amazon',
								},
							],
						},
					],
					linkCounts: { amazon: 1, skimlinks: 0, other: 0 },
				},
			],
			currentPage: 2,
			pages: 10,
			total: 250,
		});
	});

	it("leaves out the link counts and kinds when the Skimlinks domains can't be read", async () => {
		stubFetch(Response.json(searchResponse));
		const withoutDomains = createCapiArticles({
			baseUrl: 'https://capi.example.com',
			apiKey: 'test-key',
			composerBaseUrl: 'https://composer.example.com',
			readSkimlinksDomains: () => Promise.resolve(undefined),
		});

		const { articles } = await withoutDomains(2);

		expect(articles[0]?.linkCounts).toBeUndefined();
		expect(articles[0]?.products[0]?.links[0]?.kind).toBeUndefined();
	});

	it('returns no products for an article CAPI sends without body blocks', async () => {
		stubFetch(
			Response.json({
				response: {
					...searchResponse.response,
					results: [{ ...result, blocks: undefined }],
				},
			}),
		);

		const { articles } = await listArticles(2);

		expect(articles[0]?.products).toEqual([]);
	});

	it('leaves out the Composer link when CAPI has no Composer ID', async () => {
		stubFetch(
			Response.json({
				response: {
					...searchResponse.response,
					results: [{ ...result, fields: {} }],
				},
			}),
		);

		const { articles } = await listArticles(2);

		expect(articles[0]?.composerUrl).toBeUndefined();
	});

	it.each([
		['with', searchResponse],
		[
			'without',
			{
				response: {
					...searchResponse.response,
					results: [{ ...result, fields: undefined }],
				},
			},
		],
	])(
		'returns a page the client accepts, %s a Composer ID',
		async (_description, body) => {
			stubFetch(Response.json(body));

			// As the client receives it, once sent as JSON.
			const sent: unknown = JSON.parse(JSON.stringify(await listArticles(2)));

			expect(ArticlesPageSchema.safeParse(sent).success).toBe(true);
		},
	);

	it.each([
		['PROD', 'https://composer.gutools.co.uk'],
		['CODE', 'https://composer.code.dev-gutools.co.uk'],
	])('uses the %s Composer', (stage, composerBaseUrl) => {
		expect(getComposerBaseUrl(stage)).toBe(composerBaseUrl);
	});

	it.each([
		['an unrelated body', { message: 'Something else' }],
		[
			'no results list',
			{ response: { ...searchResponse.response, results: undefined } },
		],
		[
			'a result without a title',
			{
				response: {
					...searchResponse.response,
					results: [{ ...result, webTitle: undefined }],
				},
			},
		],
	])("throws when CAPI's response has %s", async (_description, body) => {
		stubFetch(Response.json(body));

		await expect(listArticles(1)).rejects.toThrow();
	});

	it('throws without revealing the API key when CAPI fails', async () => {
		stubFetch(new Response('', { status: 500 }));

		const error = await listArticles(1).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('status 500');
		expect((error as Error).message).not.toContain('test-key');
	});
});

describe('createCapiArticle', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const stubFetch = (response: Response) =>
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);

	const getArticle = createCapiArticle({
		baseUrl: 'https://capi.example.com',
		apiKey: 'test-key',
		composerBaseUrl: 'https://composer.example.com',
		readSkimlinksDomains,
	});

	it('looks up the path with the fields and body the tool needs', async () => {
		const fetch = stubFetch(Response.json({ response: { content: result } }));

		const article = await getArticle(result.id);

		const url = new URL(fetch.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			`https://capi.example.com/${result.id}`,
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			'show-fields':
				'internalComposerCode,byline,isLive,lastModified,livePricingEnabled',
			'show-blocks': 'body',
			'api-key': 'test-key',
		});
		expect(article).toMatchObject({
			id: result.id,
			byline: 'Jane Doe',
			composerUrl:
				'https://composer.example.com/content/6707d2a08f08a1b2c3d4e5f6',
		});
		expect(article?.products).toHaveLength(1);
	});

	it("returns undefined when CAPI doesn't have the path", async () => {
		stubFetch(new Response('', { status: 404 }));

		expect(await getArticle('thefilter/2026/oct/16/missing')).toBeUndefined();
	});

	it('throws without revealing the API key when CAPI fails', async () => {
		stubFetch(new Response('', { status: 500 }));

		const error = await getArticle(result.id).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('status 500');
		expect((error as Error).message).not.toContain('test-key');
	});
});

describe('createCapiArticleLinks', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const getArticleLinks = createCapiArticleLinks({
		baseUrl: 'https://capi.example.com',
		apiKey: 'test-key',
	});

	it("returns the article's web URL, headline and the links in its body", async () => {
		jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(Response.json({ response: { content: result } }));

		expect(await getArticleLinks(result.id)).toEqual({
			webUrl: result.webUrl,
			webTitle: result.webTitle,
			links: ['https://www.amazon.com/dp/B0F1ZV7PWW'],
		});
	});

	it("returns undefined when CAPI doesn't have the path", async () => {
		jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('', { status: 404 }));

		expect(
			await getArticleLinks('thefilter/2026/oct/16/missing'),
		).toBeUndefined();
	});
});

describe('live pricing', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const flaggedId = 'thefilter-us/2026/oct/12/protein-powder-faq-dietitians';

	const createListArticles = () =>
		createCapiArticles({
			baseUrl: 'https://capi.example.com',
			apiKey: 'test-key',
			composerBaseUrl: 'https://composer.example.com',
			readSkimlinksDomains,
		});

	// One page of every article's livePricingEnabled field, as the scan asks for it.
	const scanResponse = (results: object[], pages = 1) =>
		Response.json({
			response: { ...searchResponse.response, currentPage: 1, pages, results },
		});

	const searchUrls = (fetch: jest.Spied<typeof globalThis.fetch>) =>
		fetch.mock.calls.map(([url]) => new URL(url as string));

	it.each([
		['the field is true', { livePricingEnabled: 'true' }, result.id, true],
		['the field is false', { livePricingEnabled: 'false' }, result.id, false],
		['the field is a boolean', { livePricingEnabled: true }, result.id, true],
		['the field is missing', {}, result.id, false],
	])(
		'marks an article as having live pricing when %s',
		async (_description, fields, id, livePricing) => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue(
				Response.json({
					response: {
						...searchResponse.response,
						results: [{ ...result, id, fields }],
					},
				}),
			);

			const { articles } = await createListArticles()(1);

			expect(articles[0]?.livePricing).toBe(livePricing);
		},
	);

	it("lists just the flagged articles by their IDs, after reading every article's field", async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				scanResponse(
					[
						{
							...result,
							id: flaggedId,
							fields: { livePricingEnabled: 'true' },
						},
						{ ...result, id: 'thefilter/not-flagged', fields: {} },
					],
					2,
				),
			)
			.mockResolvedValueOnce(scanResponse([]))
			.mockResolvedValueOnce(Response.json(searchResponse));

		await createListArticles()(2, undefined, true);

		const [scan1, scan2, page] = searchUrls(fetch);
		expect(scan1?.searchParams.get('show-fields')).toBe('livePricingEnabled');
		expect(scan1?.searchParams.get('page-size')).toBe('200');
		expect(scan1?.searchParams.has('show-blocks')).toBe(false);
		expect(scan2?.searchParams.get('page')).toBe('2');
		expect(page?.searchParams.get('ids')).toBe(flaggedId);
		expect(page?.searchParams.has('section')).toBe(false);
		expect(page?.searchParams.get('page')).toBe('2');
	});

	it("reads just the section's articles", async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				scanResponse([
					{ ...result, id: flaggedId, fields: { livePricingEnabled: 'true' } },
				]),
			)
			.mockResolvedValueOnce(Response.json(searchResponse));

		await createListArticles()(1, 'thefilter-us', true);

		const [scan, page] = searchUrls(fetch);
		expect(scan?.searchParams.get('section')).toBe('thefilter-us');
		expect(page?.searchParams.get('ids')).toBe(flaggedId);
	});

	it('returns no articles without searching for them when none have live pricing', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(scanResponse([]));

		const page = await createListArticles()(1, 'thefilter-us', true);

		expect(page).toEqual({ articles: [], currentPage: 1, pages: 0, total: 0 });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('shares one reading of the fields between requests made at the same time', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockImplementation(() =>
				Promise.resolve(
					scanResponse([{ ...result, fields: { livePricingEnabled: 'true' } }]),
				),
			);
		const listArticles = createListArticles();

		await Promise.all([
			listArticles(1, 'thefilter', true),
			listArticles(2, 'thefilter', true),
		]);

		// One scan, then a page of the articles for each request.
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('reads the fields again after a reading fails', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response('', { status: 500 }))
			.mockImplementation(() =>
				Promise.resolve(
					scanResponse([{ ...result, fields: { livePricingEnabled: 'true' } }]),
				),
			);
		const listArticles = createListArticles();

		await expect(listArticles(1, 'thefilter', true)).rejects.toThrow();
		await listArticles(1, 'thefilter', true);

		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('reads the fields again only once the found articles are a few minutes old', async () => {
		jest.useFakeTimers({ now: 0, doNotFake: ['queueMicrotask', 'nextTick'] });
		try {
			const fetch = jest
				.spyOn(globalThis, 'fetch')
				.mockImplementation(() =>
					Promise.resolve(
						scanResponse([
							{ ...result, fields: { livePricingEnabled: 'true' } },
						]),
					),
				);
			const listArticles = createListArticles();

			await listArticles(1, 'thefilter', true);
			await listArticles(2, 'thefilter', true);
			// The scan, then a page of the articles each time.
			expect(fetch).toHaveBeenCalledTimes(3);

			jest.setSystemTime(5 * 60 * 1000 + 1);
			await listArticles(1, 'thefilter', true);
			expect(fetch).toHaveBeenCalledTimes(5);
		} finally {
			jest.useRealTimers();
		}
	});
});
