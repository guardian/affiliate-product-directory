import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type * as DatabaseServiceModule from '@common/database-service';
import type { Product } from '@common/models';
import { ArticlesPageSchema, AuthResponseSchema } from '@common/tool-models';
import type { User } from '@common/tool-models';
import { jest } from '@jest/globals';
import {
	mockGetProductPrice,
	mockUpdateProducts,
} from '@mocks/DatabaseServiceMock';
import request from 'supertest';
import { createApp } from './app';
import type { Auth, PricingTable } from './types';

let DynamoService: typeof DatabaseServiceModule.DynamoService;

describe('createApp', () => {
	let clientDir: string;
	beforeEach(() => {
		jest.clearAllMocks();
	});

	beforeAll(async () => {
		clientDir = mkdtempSync(path.join(tmpdir(), 'affiliate-products-client-'));
		mkdirSync(path.join(clientDir, 'assets'));
		writeFileSync(path.join(clientDir, 'index.html'), '<div id="root"></div>');
		writeFileSync(
			path.join(clientDir, 'assets', 'index-abc123.js'),
			'console.log("app");',
		);
		({ DynamoService } = await import('@common/database-service'));
	});

	afterAll(() => {
		rmSync(clientDir, { recursive: true, force: true });
	});

	const user: User = {
		email: 'test.user@guardian.co.uk',
		firstName: 'Test',
		lastName: 'User',
	};

	const loggedIn: Auth = {
		authenticate: () => Promise.resolve(user),
		hasAccess: (email) => Promise.resolve(email === user.email),
		listPermissions: (email) =>
			Promise.resolve(email === user.email ? ['some_permission'] : []),
		loginUrl: 'https://login.example.com/login',
	};

	const loggedOut: Auth = {
		...loggedIn,
		authenticate: () => Promise.resolve(undefined),
	};

	const loggedInWithoutAccess: Auth = {
		...loggedIn,
		hasAccess: () => Promise.resolve(false),
	};

	// CAPI's answer to a search, with one article that has one product button.
	const searchResponse = (page: number) => ({
		response: {
			currentPage: page,
			pages: 3,
			total: 250,
			results: [
				{
					id: 'thefilter/2026/oct/06/an-article',
					sectionId: 'thefilter',
					webPublicationDate: '2026-10-06T09:00:00Z',
					webTitle: 'An article',
					webUrl:
						'https://www.theguardian.com/thefilter/2026/oct/06/an-article',
					fields: { internalComposerCode: 'abc123' },
					blocks: {
						body: [
							{
								elements: [
									{
										type: 'link',
										linkTypeData: {
											url: 'https://shop.example/a-product',
											label: '£27 at Shop',
											linkType: 'product-button',
										},
									},
								],
							},
						],
					},
				},
			],
		},
	});

	// The article in searchResponse, as the tool returns it from CODE.
	const article = {
		id: 'thefilter/2026/oct/06/an-article',
		sectionId: 'thefilter',
		webPublicationDate: '2026-10-06T09:00:00Z',
		webTitle: 'An article',
		webUrl: 'https://www.theguardian.com/thefilter/2026/oct/06/an-article',
		composerUrl: 'https://composer.code.dev-gutools.co.uk/content/abc123',
		ophanUrl:
			'https://dashboard.ophan.co.uk/info?capi-id=thefilter%2F2026%2Foct%2F06%2Fan-article',
		products: [
			{
				url: 'https://shop.example/a-product',
				label: '£27 at Shop',
				basePrice: { currencySymbol: '£', amount: 27 },
			},
		],
	};

	const pricedProduct: Product = {
		productMerchantUrl: 'https://shop.example/a-product',
		region: 'GB',
		createdAt: 1750000000000,
		currency: 'GBP',
		price: 24.5,
		updatedAt: 1760000000000,
		updatedBy: 'skimlinks',
	};

	const directoryPrice = (product: Product) => ({
		currency: product.currency,
		price: product.price,
		updatedAt: product.updatedAt,
		updatedBy: product.updatedBy,
	});

	// A pricing table with these products. The directory has none of the articles'
	// products unless a test says otherwise. The rest of it is the mocked DynamoService,
	// so the manual override endpoints can use it too.
	const pricingTable = (products: Product[] = []) =>
		Object.assign(new DynamoService('TEST'), {
			getProductsByUrl: jest.fn<PricingTable['getProductsByUrl']>(() =>
				Promise.resolve(products),
			),
		});

	// CAPI, answering every search with searchResponse for the page asked for.
	let capi: ReturnType<typeof stubCapi>;
	const stubCapi = () =>
		jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
			const page = new URL(input as string).searchParams.get('page');
			return Promise.resolve(Response.json(searchResponse(Number(page))));
		});
	const capiRequests = () =>
		capi.mock.calls.map(([input]) => new URL(input as string));

	beforeEach(() => {
		capi = stubCapi();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const app = (
		auth: Auth = loggedIn,
		dynamoService: DatabaseServiceModule.DynamoService = pricingTable(),
	) =>
		createApp({
			clientDir,
			auth,
			stage: 'CODE',
			capiKey: 'code-key',
			dynamoService,
		});

	it.each([
		['/api/articles', 1],
		['/api/articles?page=2', 2],
	])('returns the articles for %s', async (url, page) => {
		const response = await request(app()).get(url);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			articles: [article],
			currentPage: page,
			pages: 3,
			total: 250,
		});
	});

	it("searches the stage's CAPI with its key", async () => {
		await request(app()).get('/api/articles?page=2');

		const [search] = capiRequests();
		expect(search?.origin).toBe('https://content.code.dev-guardianapis.com');
		expect(search?.searchParams.get('api-key')).toBe('code-key');
		expect(search?.searchParams.get('page')).toBe('2');
	});

	it("adds the directory's price to the articles' products", async () => {
		const dynamoService = pricingTable([pricedProduct]);

		const response = await request(app(loggedIn, dynamoService)).get(
			'/api/articles',
		);

		expect(response.status).toBe(200);
		// Only the products on the page are looked up.
		expect(dynamoService.getProductsByUrl).toHaveBeenCalledWith([
			'https://shop.example/a-product',
		]);
		expect(
			ArticlesPageSchema.parse(response.body).articles[0]?.products,
		).toEqual([{ ...article.products[0], ...directoryPrice(pricedProduct) }]);
	});

	it('fails, hiding the details, when the product prices cannot be read', async () => {
		const failing = pricingTable();
		failing.getProductsByUrl.mockRejectedValue(new Error('secret details'));
		jest.spyOn(console, 'error').mockImplementation(() => {});

		const response = await request(app(loggedIn, failing)).get('/api/articles');

		expect(response.status).toBe(500);
		expect(response.text).toBe('Internal server error');
	});

	describe('with PROD data', () => {
		const prodProduct: Product = { ...pricedProduct, price: 30 };

		const appWithProd = () => {
			const stageTable = pricingTable([pricedProduct]);
			const prodTable = pricingTable([prodProduct]);
			const withProd = createApp({
				clientDir,
				auth: loggedIn,
				stage: 'CODE',
				capiKey: 'code-key',
				dynamoService: stageTable,
				prod: { capiKey: 'prod-key', dynamoService: prodTable },
			});
			return { withProd, stageTable, prodTable };
		};

		it("lists PROD's articles and prices given prod=true", async () => {
			const { withProd, stageTable, prodTable } = appWithProd();

			const response = await request(withProd).get(
				'/api/articles?page=2&section=thefilter&prod=true',
			);

			expect(response.status).toBe(200);
			const [search, ...otherSearches] = capiRequests();
			expect(otherSearches).toEqual([]);
			expect(search?.origin).toBe('https://content.guardianapis.com');
			expect(search?.searchParams.get('api-key')).toBe('prod-key');
			expect(search?.searchParams.get('page')).toBe('2');
			expect(search?.searchParams.get('section')).toBe('thefilter');

			const [prodArticle] = ArticlesPageSchema.parse(response.body).articles;
			expect(prodArticle?.composerUrl).toBe(
				'https://composer.gutools.co.uk/content/abc123',
			);
			expect(prodArticle?.products).toEqual([
				{ ...article.products[0], ...directoryPrice(prodProduct) },
			]);
			expect(prodTable.getProductsByUrl).toHaveBeenCalled();
			expect(stageTable.getProductsByUrl).not.toHaveBeenCalled();
		});

		it("lists the stage's own articles and prices without prod=true", async () => {
			const { withProd, stageTable, prodTable } = appWithProd();

			const response = await request(withProd).get('/api/articles');

			expect(response.status).toBe(200);
			expect(capiRequests().map((search) => search.origin)).toEqual([
				'https://content.code.dev-guardianapis.com',
			]);
			expect(
				ArticlesPageSchema.parse(response.body).articles[0]?.products,
			).toEqual([{ ...article.products[0], ...directoryPrice(pricedProduct) }]);
			expect(stageTable.getProductsByUrl).toHaveBeenCalled();
			expect(prodTable.getProductsByUrl).not.toHaveBeenCalled();
		});
	});

	it("rejects prod=true when PROD's articles can't be listed", async () => {
		const response = await request(app()).get('/api/articles?prod=true');

		expect(response.status).toBe(400);
		expect(capi).not.toHaveBeenCalled();
	});

	it.each(['false', '1', 'TRUE', ''])('rejects prod=%s', async (prod) => {
		const response = await request(app()).get(`/api/articles?prod=${prod}`);

		expect(response.status).toBe(400);
	});

	it.each(['0', '-1', 'abc', '1.5', ''])('rejects page=%s', async (page) => {
		const response = await request(app()).get(`/api/articles?page=${page}`);

		expect(response.status).toBe(400);
	});

	it.each([
		['/api/articles?page=2', 'thefilter|thefilter-us'],
		['/api/articles?page=2&section=thefilter', 'thefilter'],
		['/api/articles?page=2&section=thefilter-us', 'thefilter-us'],
	])('passes the section from %s', async (url, section) => {
		await request(app()).get(url);

		const [search] = capiRequests();
		expect(search?.searchParams.get('section')).toBe(section);
		expect(search?.searchParams.get('page')).toBe('2');
	});

	it.each(['uk', 'us', 'sport', 'TheFilter', '', 'thefilter,thefilter-us'])(
		'rejects section=%s',
		async (section) => {
			const response = await request(app()).get(
				`/api/articles?section=${section}`,
			);

			expect(response.status).toBe(400);
		},
	);

	it('returns the logged-in user and their permissions', async () => {
		const response = await request(app()).get('/api/auth');

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			user,
			permissions: ['some_permission'],
		});
	});

	it('returns an auth response the client accepts', async () => {
		const response = await request(app()).get('/api/auth');

		expect(AuthResponseSchema.safeParse(response.body).success).toBe(true);
	});

	it('passes the request cookies to authenticate', async () => {
		let receivedCookies: string | undefined;
		const auth: Auth = {
			...loggedIn,
			authenticate: (cookieHeader) => {
				receivedCookies = cookieHeader;
				return Promise.resolve(user);
			},
		};

		await request(app(auth)).get('/').set('Cookie', 'gutoolsAuth-assym=abc');

		expect(receivedCookies).toBe('gutoolsAuth-assym=abc');
	});

	it.each(['/', '/some/deep/link?q=1', '/assets/index-abc123.js'])(
		'redirects logged-out users to login from %s, returning them afterwards',
		async (url) => {
			const response = await request(app(loggedOut))
				.get(url)
				.set('Host', 'tool.example.com');

			expect(response.status).toBe(302);
			expect(response.headers.location).toBe(
				`https://login.example.com/login?returnUrl=${encodeURIComponent(`https://tool.example.com${url}`)}`,
			);
		},
	);

	it.each(['/api/auth', '/api/articles', '/api/unknown'])(
		'returns 401 rather than redirecting for %s when logged out',
		async (url) => {
			const response = await request(app(loggedOut)).get(url);

			expect(response.status).toBe(401);
		},
	);

	it.each(['/', '/assets/index-abc123.js'])(
		'tells logged-in users without access that they lack permission at %s',
		async (url) => {
			const response = await request(app(loggedInWithoutAccess)).get(url);

			expect(response.status).toBe(403);
			expect(response.text).toBe(
				"You don't have permission to access the affiliate products tool.",
			);
		},
	);

	it.each(['/api/auth', '/api/articles'])(
		'returns 403 from %s for logged-in users without access',
		async (url) => {
			const response = await request(app(loggedInWithoutAccess)).get(url);

			expect(response.status).toBe(403);
			expect(response.body).toEqual({
				error:
					"You don't have permission to access the affiliate products tool.",
			});
		},
	);

	it('hides error details from users', async () => {
		const failing: Auth = {
			...loggedIn,
			authenticate: () => Promise.reject(new Error('secret details')),
		};
		jest.spyOn(console, 'error').mockImplementation(() => {});

		const response = await request(app(failing)).get('/');

		expect(response.status).toBe(500);
		expect(response.text).toBe('Internal server error');
	});

	it('returns 404 for unknown API paths rather than the app', async () => {
		const response = await request(app()).get('/api/unknown');

		expect(response.status).toBe(404);
		expect(response.text).not.toContain('<div id="root">');
	});

	it.each(['/', '/some/deep/link'])('serves the app at %s', async (url) => {
		const response = await request(app()).get(url);

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('text/html');
		expect(response.headers['cache-control']).toBe('no-cache');
		expect(response.text).toContain('<div id="root">');
	});

	it('serves the app when given a relative client directory', async () => {
		const relativeClientDir = path.relative(process.cwd(), clientDir);
		const response = await request(
			createApp({
				clientDir: relativeClientDir,
				auth: loggedIn,
				stage: 'CODE',
				capiKey: 'code-key',
				dynamoService: pricingTable(),
			}),
		).get('/some/deep/link');

		expect(response.status).toBe(200);
		expect(response.text).toContain('<div id="root">');
	});

	it('serves hashed assets with a long-lived cache', async () => {
		const response = await request(app()).get('/assets/index-abc123.js');

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('javascript');
		expect(response.headers['cache-control']).toContain('immutable');
	});

	it('sets a manual override and updates the product', async () => {
		const product = {
			productMerchantUrl: 'https://shop.example.com/products/123',
			currency: 'GBP',
			price: 10,
			createdAt: 1,
			region: 'GB',
			updatedAt: 1,
			updatedBy: 'shopify',
		};
		mockGetProductPrice.mockResolvedValueOnce(product);
		mockUpdateProducts.mockResolvedValueOnce({ skipped: [] });
		const now = Date.parse('2026-10-13T12:00:00.000Z');
		const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);

		const response = await request(app()).post('/api/manualOverride').send({
			productMerchantUrl: product.productMerchantUrl,
			currency: 'GBP',
			price: 12,
			expiryDate: '2030-01-01T00:00:00.000Z',
		});

		expect(response.status).toBe(204);
		expect(mockGetProductPrice).toHaveBeenCalledWith(
			product.productMerchantUrl,
		);
		try {
			// Send the POST request and make the existing assertions.
			expect(mockUpdateProducts).toHaveBeenCalledWith({
				items: [
					expect.objectContaining({
						...product,
						price: 12,
						expiresAt: Date.parse('2030-01-01T00:00:00.000Z'),
						updatedBy: 'manualOverride',
						updatedAt: now,
					}),
				],
			});
		} finally {
			dateNow.mockRestore();
		}
	});

	it('rejects malformed manual override input', async () => {
		const response = await request(app()).post('/api/manualOverride').send({
			productMerchantUrl: 'https://shop.example.com/products/123',
			currency: 'GBP',
			price: 'not-a-number',
		});

		expect(response.status).toBe(400);
		expect(mockGetProductPrice).not.toHaveBeenCalled();
		expect(mockUpdateProducts).not.toHaveBeenCalled();
	});

	it('returns 401 for an unauthenticated manual override request', async () => {
		const response = await request(app(loggedOut))
			.post('/api/manualOverride')
			.send({
				productMerchantUrl: 'https://shop.example.com/products/123',
				currency: 'GBP',
				price: 12,
			});

		expect(response.status).toBe(401);
		expect(mockGetProductPrice).not.toHaveBeenCalled();
		expect(mockUpdateProducts).not.toHaveBeenCalled();
	});
});
