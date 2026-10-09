import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from './app';

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

	const app = () => createApp({ clientDir });

	it('reports the user as authenticated', async () => {
		const response = await request(app()).get('/api/auth');

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ authenticated: true });
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
			createApp({ clientDir: relativeClientDir }),
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
