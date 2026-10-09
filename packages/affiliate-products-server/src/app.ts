import path from 'path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Auth, User } from './auth';

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API sit behind the same auth middleware.
 */
export function createApp({
	clientDir,
	auth,
}: {
	clientDir: string;
	auth: Auth;
}) {
	const app = express();

	app.use(async (req, res, next) => {
		const user = await auth.authenticate(req.header('Cookie'));
		if (user) {
			res.locals.user = user;
			return next();
		}
		// The client can't follow a redirect to the login page from a fetch, so it's told instead.
		if (req.path.startsWith('/api/')) {
			return res.status(401).json({ error: 'Not authenticated' });
		}
		const returnUrl = `https://${req.get('host')}${req.originalUrl}`;
		res.redirect(`${auth.loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`);
	});

	app.get('/api/auth', async (_req, res) => {
		const user = res.locals.user as User;
		const permissions = await auth.listPermissions(user.email);
		res.json({ user, permissions });
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

	// Express's default error page includes the stack trace unless NODE_ENV is production,
	// which Lambda doesn't set. Express recognises error handlers by their four parameters.
	app.use(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express needs all four parameters.
		(error: unknown, _req: Request, res: Response, _next: NextFunction) => {
			console.error(error);
			res.status(500).send('Internal server error');
		},
	);

	return app;
}
