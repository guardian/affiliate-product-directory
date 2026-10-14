import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type * as DatabaseServiceModule from '@common/database-service';
import { jest } from '@jest/globals';
import {
	mockGetProductPrice,
	mockUpdateProducts,
} from '@mocks/DatabaseServiceMock';
import request from 'supertest';
import { createApp } from './app';
import type { Auth, User } from './auth';

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
		listPermissions: (email) =>
			Promise.resolve(email === user.email ? ['some_permission'] : []),
		loginUrl: 'https://login.example.com/login',
	};

	const loggedOut: Auth = {
		...loggedIn,
		authenticate: () => Promise.resolve(undefined),
	};

	const app = (auth: Auth = loggedIn) =>
		createApp({ clientDir, auth, dynamoService: new DynamoService('TEST') });

	it('returns the logged-in user and their permissions', async () => {
		const response = await request(app()).get('/api/auth');

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			user,
			permissions: ['some_permission'],
		});
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

	it.each(['/api/auth', '/api/unknown'])(
		'returns 401 rather than redirecting for %s when logged out',
		async (url) => {
			const response = await request(app(loggedOut)).get(url);

			expect(response.status).toBe(401);
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
				dynamoService: new DynamoService('TEST'),
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
		mockUpdateProducts.mockResolvedValueOnce(undefined);
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

		expect(response.status).toBe(500);
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
