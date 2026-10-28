import path from 'path';
import { articlePath } from '@common/articlePath';
import { getCapiBaseUrl } from '@common/config';
import type { DynamoService } from '@common/database-service';
import { composerOriginsForStage } from '@common/embed';
import { livePricingAllowListIds } from '@common/livePricing';
import { ArticleStatusSchema, SectionSchema } from '@common/tool-models';
import type { ArticlesPage, AuthResponse, User } from '@common/tool-models';
import { ProductsUpdater } from '@price-update/ProductsUpdater';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
	createCapiArticle,
	createCapiArticleLinks,
	createCapiArticles,
	getComposerBaseUrl,
} from './capi';
import { embedProducts } from './embedProducts';
import { linksCsv, shortTitle } from './linkCounts';
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
import type {
	Auth,
	GetArticle,
	ListDrafts,
	ReadSkimlinksDomains,
} from './types';

const noAccessMessage =
	"You don't have permission to access the affiliate products tool.";

const readStage = ({
	stage,
	capiKey,
	listDrafts,
	dynamoService,
	readSkimlinksDomains,
}: {
	stage: string;
	capiKey: string;
	listDrafts?: ListDrafts;
	dynamoService: DynamoService;
	readSkimlinksDomains: ReadSkimlinksDomains;
}) => {
	const capi = {
		baseUrl: getCapiBaseUrl(stage),
		apiKey: capiKey,
		composerBaseUrl: getComposerBaseUrl(stage),
		livePricingIds: livePricingAllowListIds(stage),
		readSkimlinksDomains,
	};
	return {
		listDrafts,
		listArticles: createCapiArticles(capi),
		getArticle: createCapiArticle(capi),
		getArticleLinks: createCapiArticleLinks(capi),
		getProductPrices: createProductPrices((urls) =>
			dynamoService.getProductsByUrl(urls),
		),
	};
};

/** The article path in a query parameter, an article's URL or path, if it is one. */
const readArticlePath = (param: unknown) =>
	typeof param === 'string' ? articlePath(param) : undefined;

/** The article at a path as a page of its own, with no articles if there isn't one. */
const findArticle = async (
	getArticle: GetArticle,
	path: string,
): Promise<ArticlesPage> => {
	const article = await getArticle(path);
	return {
		articles: article ? [article] : [],
		currentPage: 1,
		pages: 1,
		total: article ? 1 : 0,
	};
};

const noArticles: ArticlesPage = {
	articles: [],
	currentPage: 1,
	pages: 0,
	total: 0,
};

/**
 * The drafts, or undefined if they can't be read, so that the live articles are still
 * listed when the drafts can't be.
 */
const readDrafts = async (
	listDrafts: ListDrafts | undefined,
	section: Parameters<ListDrafts>[0],
) => {
	if (!listDrafts) {
		return undefined;
	}
	try {
		return await listDrafts(section);
	} catch (error) {
		console.error(error);
		return undefined;
	}
};

const escapeHtml = (text: string) =>
	text.replace(
		/[&<>"]/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char,
	);

/**
 * What the embed shows to an editor who isn't logged in. Panda's login page can't be
 * shown in Composer's iframe, so it's opened in a new tab instead.
 */
const embedLoginPage = (loginUrl: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Log in to the affiliate products tool</title></head>
<body style="font-family: system-ui, sans-serif; font-size: 14px; margin: 12px;">
<p><a href="${escapeHtml(loginUrl)}" target="_blank" rel="noreferrer">Log in to the affiliate products tool</a> to see live prices for this article's products.</p>
<p>Then reload this panel.</p>
</body>
</html>`;

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API sit behind the same auth middleware.
 */
export function createApp({
	clientDir,
	auth,
	stage,
	capiKey,
	listDrafts,
	dynamoService,
	prod,
	readSkimlinksDomains,
}: {
	clientDir: string;
	auth: Auth;
	/** The stage whose CAPI, Composer and pricing table the articles come from by default. */
	stage: string;
	capiKey: string;
	listDrafts?: ListDrafts;
	dynamoService: DynamoService;
	/** PROD's CAPI key, drafts and pricing table, used instead when asked for with prod=true. */
	prod?: {
		capiKey: string;
		listDrafts?: ListDrafts;
		dynamoService: DynamoService;
		/** Whether PROD's prices may be set by hand from here, which is switched on and off. */
		canEditPrices?: () => Promise<boolean>;
	};
	/** The Skimlinks merchants' domains, for sorting the links in articles. */
	readSkimlinksDomains: ReadSkimlinksDomains;
}) {
	const productsUpdater = new ProductsUpdater(dynamoService);

	const app = express();
	app.use(
		rateLimit({
			windowMs: 15 * 60 * 1000,
			limit: 500,
			standardHeaders: 'draft-8',
			legacyHeaders: false,
			message: { error: 'Too many requests, please try again later.' },
		}),
	);
	// Composer sends the whole body of a draft, which can be bigger than express.json's default.
	app.use('/api/embed', express.json({ limit: '2mb' }));
	app.use(express.json());

	// Only Composer may show the embed in a frame.
	const embedFrameAncestors = `frame-ancestors ${composerOriginsForStage(stage).join(' ')}`;
	app.use('/embed', (_req, res, next) => {
		res.setHeader('Content-Security-Policy', embedFrameAncestors);
		next();
	});

	const stageData = readStage({
		stage,
		capiKey,
		listDrafts,
		dynamoService,
		readSkimlinksDomains,
	});
	const prodData =
		prod && readStage({ stage: 'PROD', ...prod, readSkimlinksDomains });

	/**
	 * The stage's data, or PROD's when asked for with prod=true. Undefined, having responded
	 * with an error, if prod is anything else, or PROD's data can't be read here.
	 */
	const readDataSource = (req: Request, res: Response) => {
		const prodParam = z.literal('true').optional().safeParse(req.query.prod);
		if (!prodParam.success) {
			res.status(400).json({ error: 'prod must be true, or left out' });
			return undefined;
		}
		const dataSource = prodParam.data ? prodData : stageData;
		// Fails rather than reading this stage's articles as if they were PROD's.
		if (!dataSource) {
			res.status(400).json({ error: "PROD's articles can't be read here" });
		}
		return dataSource;
	};

	const canEditProdPrices = async () =>
		(await prod?.canEditPrices?.()) ?? false;

	/**
	 * The stage's pricing table, or PROD's when asked for with prod=true and its switch is
	 * on. Undefined, having responded with an error, otherwise.
	 */
	const pricingTableToWrite = async (req: Request, res: Response) => {
		const prodParam = z.literal('true').optional().safeParse(req.query.prod);
		if (!prodParam.success) {
			res.status(400).json({ error: 'prod must be true, or left out' });
			return undefined;
		}
		if (!prodParam.data) {
			return dynamoService;
		}
		if (!prod) {
			res.status(400).json({ error: "PROD's prices can't be set here" });
			return undefined;
		}
		if (!(await canEditProdPrices())) {
			res
				.status(403)
				.json({ error: "Setting PROD's prices from here is switched off" });
			return undefined;
		}
		return prod.dynamoService;
	};

	app.use(async (req, res, next) => {
		const isApiRequest = req.path.startsWith('/api/');

		const user = await auth.authenticate(req.header('Cookie'));
		if (!user) {
			// The client can't follow a redirect to the login page from a fetch, so it's told instead.
			if (isApiRequest) {
				return res.status(401).json({ error: 'Not authenticated' });
			}
			if (req.path === '/embed') {
				const returnUrl = `https://${req.get('host')}/`;
				return res
					.status(401)
					.type('html')
					.send(
						embedLoginPage(
							`${auth.loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`,
						),
					);
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

	// The switches the client needs, to show what can be done.
	app.get('/api/switches', async (_req, res) => {
		res.json({ editProdPrices: await canEditProdPrices() });
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
		// An article's URL or path, to show just that article rather than a page of them.
		const path = readArticlePath(req.query.path);
		if (req.query.path !== undefined && !path) {
			res.status(400).json({ error: "path must be an article's URL or path" });
			return;
		}
		const status = ArticleStatusSchema.optional().safeParse(req.query.status);
		if (!status.success) {
			res.status(400).json({
				error: `status must be one of ${ArticleStatusSchema.options.join(', ')}`,
			});
			return;
		}
		// Just the articles with live pricing, which are all published.
		const livePricing = z
			.literal('true')
			.optional()
			.safeParse(req.query.livePricing);
		if (!livePricing.success) {
			res.status(400).json({ error: 'livePricing must be true, or left out' });
			return;
		}
		const onlyLivePricing = livePricing.data === 'true';
		const dataSource = readDataSource(req, res);
		if (!dataSource) {
			return;
		}
		// The drafts come before the live articles, so they're only on the first page.
		const showDrafts =
			!path &&
			!onlyLivePricing &&
			(status.data === 'draft' || (status.data === undefined && page === '1'));
		const showLive = status.data !== 'draft';
		const [drafts, livePage] = await Promise.all([
			showDrafts
				? readDrafts(dataSource.listDrafts, section.data)
				: Promise.resolve(undefined),
			path
				? findArticle(dataSource.getArticle, path)
				: showLive
					? dataSource.listArticles(Number(page), section.data, onlyLivePricing)
					: Promise.resolve(noArticles),
		]);
		const articlesPage: ArticlesPage = drafts
			? { drafts, ...livePage }
			: livePage;
		const productPrices = await dataSource.getProductPrices(
			productUrls(articlesPage),
		);
		res.json(attachProductPrices(articlesPage, productPrices));
	});

	// The bookmarklet's CSV of the external links in an article's body.
	app.get('/api/links.csv', async (req, res) => {
		const path = readArticlePath(req.query.path);
		if (!path) {
			res.status(400).json({ error: "path must be an article's URL or path" });
			return;
		}
		const dataSource = readDataSource(req, res);
		if (!dataSource) {
			return;
		}
		const [article, skimlinksDomains] = await Promise.all([
			dataSource.getArticleLinks(path),
			readSkimlinksDomains(),
		]);
		if (!article) {
			res.status(404).json({ error: 'There is no article at that path' });
			return;
		}
		if (!skimlinksDomains) {
			res.status(503).json({ error: "The Skimlinks domains couldn't be read" });
			return;
		}
		res.attachment(`${shortTitle(article.webUrl)}-links.csv`);
		res.type('text/csv; charset=utf-8');
		res.send(linksCsv(article, skimlinksDomains));
	});

	app.post('/api/manualOverride', async (req, res) => {
		// ToDo: check user has permission to perform this
		const table = await pricingTableToWrite(req, res);
		if (!table) {
			return;
		}
		const result = await handleOverrideRequest(req.body, table);
		if (!result.ok) {
			return res.status(result.status).json({ error: result.error });
		}
		return res.sendStatus(204);
	});

	app.delete('/api/manualOverride', async (req, res) => {
		// ToDo: check user has permission to perform this
		const table = await pricingTableToWrite(req, res);
		if (!table) {
			return;
		}
		const result = await handleOverrideDeleteRequest(req.body, table);
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

	// The products in a draft that Composer has sent to the embed, with their prices.
	app.post('/api/embed/products', async (req, res) => {
		const result = await embedProducts(
			req.body,
			(urls) => dynamoService.getProductsByUrl(urls),
			(products) => productsUpdater.getPreviewPrices(products),
		);
		if (!result.ok) {
			return res.status(400).json({ error: result.error });
		}
		return res.json(result.body);
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
