import { ArticlesPageSchema } from '@common/tool-models';
import { jest } from '@jest/globals';
import {
	createCapiArticle,
	createCapiArticles,
	createCapiDrafts,
	draftsSearchSize,
	getComposerBaseUrl,
} from './capi';

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
			'show-fields': 'internalComposerCode,byline,isLive,lastModified',
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
								},
							],
						},
					],
				},
			],
			currentPage: 2,
			pages: 10,
			total: 250,
		});
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
	});

	it('looks up the path with the fields and body the tool needs', async () => {
		const fetch = stubFetch(Response.json({ response: { content: result } }));

		const article = await getArticle(result.id);

		const url = new URL(fetch.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			`https://capi.example.com/${result.id}`,
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			'show-fields': 'internalComposerCode,byline,isLive,lastModified',
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

describe('createCapiDrafts', () => {
	// Preview CAPI has drafts, which have no publication date, as well as live articles.
	const draft = {
		...result,
		id: 'thefilter/2026/oct/16/a-draft',
		webPublicationDate: undefined,
		webUrl: 'https://www.theguardian.com/thefilter/2026/oct/16/a-draft',
		fields: {
			...result.fields,
			isLive: 'false',
			lastModified: '2026-10-16T08:00:00Z',
		},
	};
	const live = { ...result, fields: { ...result.fields, isLive: 'true' } };

	const stubPreview = (results: unknown[]) =>
		jest.fn<(url: string) => Promise<Response>>(() =>
			Promise.resolve(
				Response.json({ response: { ...searchResponse.response, results } }),
			),
		);

	const listDrafts = (fetchPreview: (url: string) => Promise<Response>) =>
		createCapiDrafts({
			baseUrl: 'https://preview.example.com',
			composerBaseUrl: 'https://composer.example.com',
			fetchPreview,
		});

	it('searches the most recently changed articles in both Filter sections, without an API key', async () => {
		const fetchPreview = stubPreview([]);

		await listDrafts(fetchPreview)();

		const url = new URL(fetchPreview.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe(
			'https://preview.example.com/search',
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			section: 'thefilter|thefilter-us',
			'order-by': 'newest',
			'use-date': 'last-modified',
			'page-size': String(draftsSearchSize),
			'show-fields': 'internalComposerCode,byline,isLive,lastModified',
			'show-blocks': 'body',
		});
	});

	it('searches only the section given', async () => {
		const fetchPreview = stubPreview([]);

		await listDrafts(fetchPreview)('thefilter-us');

		const url = new URL(fetchPreview.mock.calls[0]?.[0] as string);
		expect(url.searchParams.get('section')).toBe('thefilter-us');
	});

	it('returns only the drafts, without a link to the live site', async () => {
		const drafts = await listDrafts(stubPreview([live, draft]))();

		expect(drafts).toEqual([
			expect.objectContaining({
				id: draft.id,
				status: 'draft',
				webPublicationDate: undefined,
				webUrl: undefined,
				lastModified: '2026-10-16T08:00:00Z',
				composerUrl:
					'https://composer.example.com/content/6707d2a08f08a1b2c3d4e5f6',
			}),
		]);
		expect(drafts[0]?.products).toHaveLength(1);
	});

	it('returns drafts the client accepts', async () => {
		const drafts = await listDrafts(stubPreview([draft]))();

		const sent: unknown = JSON.parse(
			JSON.stringify({
				drafts,
				articles: [],
				currentPage: 1,
				pages: 0,
				total: 0,
			}),
		);

		expect(ArticlesPageSchema.safeParse(sent).success).toBe(true);
	});

	it('throws when Preview CAPI fails', async () => {
		const fetchPreview = jest.fn<(url: string) => Promise<Response>>(() =>
			Promise.resolve(new Response('', { status: 403 })),
		);

		await expect(listDrafts(fetchPreview)()).rejects.toThrow('status 403');
	});
});
