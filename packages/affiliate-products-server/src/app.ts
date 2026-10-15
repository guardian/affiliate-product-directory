import path from 'path';
import { SectionSchema } from '@common/tool-models';
import type { AuthResponse, User } from '@common/tool-models';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { attachProductPrices, productUrls } from './productPrices';
import type { Auth, DataSource, GetProductPrices, ListArticles } from './types';

const noAccessMessage =
	"You don't have permission to access the affiliate products tool.";

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API sit behind the same auth middleware.
 */
export function createApp({
	clientDir,
	auth,
	listArticles,
	getProductPrices,
	prodData,
}: {
	clientDir: string;
	auth: Auth;
	listArticles: ListArticles;
	getProductPrices: GetProductPrices;
	/** PROD's articles and prices, listed instead of the stage's own when asked for with prod=true. */
	prodData?: DataSource;
}) {
	const app = express();

	app.use(async (req, res, next) => {
		const isApiRequest = req.path.startsWith('/api/');

		const user = await auth.authenticate(req.header('Cookie'));
		if (!user) {
			// The client can't follow a redirect to the login page from a fetch, so it's told instead.
			if (isApiRequest) {
				return res.status(401).json({ error: 'Not authenticated' });
			}
			const returnUrl = `https://${req.get('host')}${req.originalUrl}`;
			return res.redirect(
				`${auth.loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`,
			);
		}

		if (!(await auth.hasAccess(user.email))) {
			return isApiRequest
				? res.status(403).json({ error: noAccessMessage })
				: res.status(403).send(noAccessMessage);
		}

		res.locals.user = user;
		next();
	});

	app.get('/api/auth', async (_req, res) => {
		const user = res.locals.user as User;
		const permissions = await auth.listPermissions(user.email);
		const body: AuthResponse = { user, permissions };
		res.json(body);
	});

	app.get('/api/articles', async (req, res) => {
		const { page = '1' } = req.query;
		if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page)) {
			res.status(400).json({ error: 'page must be a positive integer' });
			return;
		}
		const section = SectionSchema.optional().safeParse(req.query.section);
		if (!section.success) {
			res.status(400).json({
				error: `section must be one of ${SectionSchema.options.join(', ')}`,
			});
			return;
		}
		const prod = z.literal('true').optional().safeParse(req.query.prod);
		if (!prod.success) {
			res.status(400).json({ error: 'prod must be true, or left out' });
			return;
		}
		const dataSource = prod.data
			? prodData
			: { listArticles, getProductPrices };
		// Fails rather than listing this stage's articles as if they were PROD's.
		if (!dataSource) {
			res.status(400).json({ error: "PROD's articles can't be listed here" });
			return;
		}
		const articlesPage = await dataSource.listArticles(
			Number(page),
			section.data,
		);
		const productPrices = await dataSource.getProductPrices(
			productUrls(articlesPage),
		);
		res.json(attachProductPrices(articlesPage, productPrices));
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
