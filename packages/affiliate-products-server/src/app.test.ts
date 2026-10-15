import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { ArticlesPageSchema, AuthResponseSchema } from '@common/tool-models';
import type { ArticlesPage, User } from '@common/tool-models';
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from './app';
import type {
	Auth,
	DataSource,
	GetProductPrices,
	ListArticles,
	ProductPrices,
} from './types';

describe('createApp', () => {
	let clientDir: string;

	beforeAll(() => {
		clientDir = mkdtempSync(path.join(tmpdir(), 'affiliate-products-client-'));
		mkdirSync(path.join(clientDir, 'assets'));
		writeFileSync(path.join(clientDir, 'index.html'), '<div id="root"></div>');
		writeFileSync(
			path.join(clientDir, 'assets', 'index-abc123.js'),
			'console.log("app");',
		);
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

	const articlesPage = (page: number): ArticlesPage => ({
		articles: [
			{
				id: 'thefilter/2026/oct/06/an-article',
				sectionId: 'thefilter',
				webPublicationDate: '2026-10-06T09:00:00Z',
				webTitle: 'An article',
				webUrl: 'https://www.theguardian.com/thefilter/2026/oct/06/an-article',
				composerUrl: 'https://composer.example.com/content/abc123',
				ophanUrl:
					'https://dashboard.ophan.co.uk/info?capi-id=thefilter%2F2026%2Foct%2F06%2Fan-article',
				products: [
					{
						url: 'https://shop.example/a-product',
						label: '£27 at Shop',
						productName: 'A product',
						basePrice: { currencySymbol: '£', amount: 27 },
					},
				],
			},
		],
		currentPage: page,
		pages: 3,
		total: 250,
	});

	const listArticles: ListArticles = (page) =>
		Promise.resolve(articlesPage(page));

	// The directory has none of the articles' products unless a test says otherwise.
	const noProductPrices: GetProductPrices = () =>
		Promise.resolve<ProductPrices>(new Map());

	const app = (
		auth: Auth = loggedIn,
		getProductPrices: GetProductPrices = noProductPrices,
	) => createApp({ clientDir, auth, listArticles, getProductPrices });

	it.each([
		['/api/articles', 1],
		['/api/articles?page=2', 2],
	])('returns the articles for %s', async (url, page) => {
		const response = await request(app()).get(url);

		expect(response.status).toBe(200);
		expect(response.body).toEqual(articlesPage(page));
	});

	it("adds the directory's price to the articles' products", async () => {
		const directoryPrice = {
			currency: 'GBP',
			price: 24.5,
			updatedAt: 1760000000000,
			updatedBy: 'skimlinks',
		};
		const getProductPrices = jest.fn<GetProductPrices>(() =>
			Promise.resolve(
				new Map([['https://shop.example/a-product', directoryPrice]]),
			),
		);

		const response = await request(app(loggedIn, getProductPrices)).get(
			'/api/articles',
		);

		expect(response.status).toBe(200);
		// Only the products on the page are looked up.
		expect(getProductPrices).toHaveBeenCalledWith([
			'https://shop.example/a-product',
		]);
		expect(
			ArticlesPageSchema.parse(response.body).articles[0]?.products,
		).toEqual([
			{
				url: 'https://shop.example/a-product',
				label: '£27 at Shop',
				productName: 'A product',
				basePrice: { currencySymbol: '£', amount: 27 },
				...directoryPrice,
			},
		]);
	});

	it('fails, hiding the details, when the product prices cannot be read', async () => {
		const failing: GetProductPrices = () =>
			Promise.reject(new Error('secret details'));
		jest.spyOn(console, 'error').mockImplementation(() => {});

		const response = await request(app(loggedIn, failing)).get('/api/articles');

		expect(response.status).toBe(500);
		expect(response.text).toBe('Internal server error');
	});

	describe('with PROD data', () => {
		const prodPrice = {
			currency: 'GBP',
			price: 30,
			updatedAt: 1760000000000,
			updatedBy: 'skimlinks',
		};

		const prodData = (): DataSource => ({
			listArticles: jest.fn<ListArticles>((page) =>
				Promise.resolve({ ...articlesPage(page), total: 999 }),
			),
			getProductPrices: jest.fn<GetProductPrices>(() =>
				Promise.resolve(
					new Map([['https://shop.example/a-product', prodPrice]]),
				),
			),
		});

		it("lists PROD's articles and prices given prod=true", async () => {
			const prod = prodData();
			const getProductPrices = jest.fn(noProductPrices);
			const listArticlesSpy = jest.fn(listArticles);

			const response = await request(
				createApp({
					clientDir,
					auth: loggedIn,
					listArticles: listArticlesSpy,
					getProductPrices,
					prodData: prod,
				}),
			).get('/api/articles?page=2&section=thefilter&prod=true');

			expect(response.status).toBe(200);
			const page = ArticlesPageSchema.parse(response.body);
			expect(page.total).toBe(999);
			expect(page.articles[0]?.products[0]).toMatchObject(prodPrice);
			expect(prod.listArticles).toHaveBeenCalledWith(2, 'thefilter');
			expect(prod.getProductPrices).toHaveBeenCalledWith([
				'https://shop.example/a-product',
			]);
			// The stage's own data isn't read.
			expect(listArticlesSpy).not.toHaveBeenCalled();
			expect(getProductPrices).not.toHaveBeenCalled();
		});

		it("lists the stage's own articles without prod=true", async () => {
			const prod = prodData();

			const response = await request(
				createApp({
					clientDir,
					auth: loggedIn,
					listArticles,
					getProductPrices: noProductPrices,
					prodData: prod,
				}),
			).get('/api/articles');

			expect(response.status).toBe(200);
			expect(response.body).toEqual(articlesPage(1));
			expect(prod.listArticles).not.toHaveBeenCalled();
			expect(prod.getProductPrices).not.toHaveBeenCalled();
		});
	});

	it("rejects prod=true when PROD's articles can't be listed", async () => {
		const response = await request(app()).get('/api/articles?prod=true');

		expect(response.status).toBe(400);
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
		['/api/articles?page=2', undefined],
		['/api/articles?page=2&section=thefilter', 'thefilter'],
		['/api/articles?page=2&section=thefilter-us', 'thefilter-us'],
	])('passes the section from %s', async (url, section) => {
		const requests: Array<[number, string | undefined]> = [];
		const recordingListArticles: ListArticles = (page, requestedSection) => {
			requests.push([page, requestedSection]);
			return Promise.resolve(articlesPage(page));
		};

		await request(
			createApp({
				clientDir,
				auth: loggedIn,
				listArticles: recordingListArticles,
				getProductPrices: noProductPrices,
			}),
		).get(url);

		expect(requests).toEqual([[2, section]]);
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
				listArticles,
				getProductPrices: noProductPrices,
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
});
