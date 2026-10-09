import path from 'path';
import express from 'express';

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API can later sit behind the same auth middleware.
 */
export function createApp({ clientDir }: { clientDir: string }) {
	const app = express();

	// Mock until panda auth is added.
	app.get('/api/auth', (_req, res) => {
		res.json({ authenticated: true });
	});

	// Unknown API paths shouldn't fall through to the SPA's index.html.
	app.use('/api', (_req, res) => {
		res.status(404).json({ error: 'Not found' });
	});

	// Vite gives assets content-hashed filenames, so they can be cached indefinitely.
	app.use(
		'/assets',
		express.static(path.join(clientDir, 'assets'), {
			immutable: true,
			maxAge: '1y',
		}),
	);
	app.use(express.static(clientDir, { index: false }));

	// Any other path is a client-side route, so serve the app.
	app.get('/{*splat}', (_req, res) => {
		res.setHeader('Cache-Control', 'no-cache');
		res.sendFile('index.html', { root: clientDir });
	});

	return app;
}
