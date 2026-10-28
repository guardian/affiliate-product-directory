import path from 'path';
import { getCapiBaseUrl } from '@common/config';
import type { DynamoService } from '@common/database-service';
import { SectionSchema } from '@common/tool-models';
import type { AuthResponse, User } from '@common/tool-models';
import { ProductsUpdater } from '@price-update/ProductsUpdater';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createCapiArticles, getComposerBaseUrl } from './capi';
import {
	handleOverrideDeleteRequest,
	handleOverrideRequest,
} from './manual-override/manualOverrideHandlers';
import { handlePreviewRequest } from './preview/previewRequestHandler';
import {
	attachProductPrices,
	createProductPrices,
	productUrls,
} from './productPrices';
import type { Auth } from './types';

const noAccessMessage =
	"You don't have permission to access the affiliate products tool.";

/**
 * Lists a stage's articles from its CAPI, linking to its Composer, with their prices from
 * its pricing table, read on every request so nothing is cached between them.
 */
const readStage = ({
	stage,
	capiKey,
	dynamoService,
}: {
	stage: string;
	capiKey: string;
	dynamoService: DynamoService;
}) => ({
	listArticles: createCapiArticles({
		baseUrl: getCapiBaseUrl(stage),
		apiKey: capiKey,
		composerBaseUrl: getComposerBaseUrl(stage),
	}),
	getProductPrices: createProductPrices((urls) =>
		dynamoService.getProductsByUrl(urls),
	),
});

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API sit behind the same auth middleware.
 */
export function createApp({
	clientDir,
	auth,
	stage,
	capiKey,
	dynamoService,
	prod,
}: {
	clientDir: string;
	auth: Auth;
	/** The stage whose CAPI, Composer and pricing table the articles come from by default. */
	stage: string;
	capiKey: string;
	dynamoService: DynamoService;
	/** PROD's CAPI key and pricing table, used instead when asked for with prod=true. */
	prod?: { capiKey: string; dynamoService: DynamoService };
}) {
	const productsUpdater = new ProductsUpdater(dynamoService);

	const app = express();
	app.use(express.json());

	const stageData = readStage({ stage, capiKey, dynamoService });
	const prodData = prod && readStage({ stage: 'PROD', ...prod });

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

		if (!auth.hasAccess(user.email)) {
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
		const prodParam = z.literal('true').optional().safeParse(req.query.prod);
		if (!prodParam.success) {
			res.status(400).json({ error: 'prod must be true, or left out' });
			return;
		}
		const dataSource = prodParam.data ? prodData : stageData;
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

	app.post('/api/manualOverride', async (req, res) => {
		// ToDo: check user has permission to perform this
		const result = await handleOverrideRequest(req.body, dynamoService);
		if (!result.ok) {
			return res.status(result.status).json({ error: result.error });
		}
		return res.sendStatus(204);
	});

	app.delete('/api/manualOverride', async (req, res) => {
		// ToDo: check user has permission to perform this
		const result = await handleOverrideDeleteRequest(req.body, dynamoService);
		if (!result.ok) {
			return res.status(result.status).json({ error: result.error });
		}
		return res.sendStatus(204);
	});

	app.post('/api/preview', async (req, res) => {
		const result = await handlePreviewRequest(req.body, productsUpdater);
		if (!result.ok) {
			return res.status(result.status).json({ error: result.error });
		}
		return res.status(200).json(result.products);
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
