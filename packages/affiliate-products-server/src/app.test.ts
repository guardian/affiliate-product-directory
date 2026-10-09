import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from './app';
import type { Auth, User } from './auth';

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
		listPermissions: (email) =>
			Promise.resolve(email === user.email ? ['some_permission'] : []),
		loginUrl: 'https://login.example.com/login',
	};

	const loggedOut: Auth = {
		...loggedIn,
		authenticate: () => Promise.resolve(undefined),
	};

	const app = (auth: Auth = loggedIn) => createApp({ clientDir, auth });

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
			createApp({ clientDir: relativeClientDir, auth: loggedIn }),
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
