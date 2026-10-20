import path from 'path';
import { articlePath } from '@common/articlePath';
import { getCapiBaseUrl, getPreviewCapiBaseUrl } from '@common/config';
import type { DynamoService } from '@common/database-service';
import { ArticleStatusSchema, SectionSchema } from '@common/tool-models';
import type {
	ArticlesPage,
	AuthResponse,
	LinkCounts,
	User,
} from '@common/tool-models';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
	createCapiArticle,
	createCapiArticles,
	createCapiDrafts,
	getComposerBaseUrl,
} from './capi';
import {
	countLinks,
	fetchRenderedPage,
	linksCsv,
	renderedPageUrl,
} from './linkCounts';
import {
	handleOverrideDeleteRequest,
	handleOverrideRequest,
} from './manual-override/manualOverrideHandlers';
import {
	attachProductPrices,
	createProductPrices,
	productUrls,
} from './productPrices';
import type { Auth, GetArticle, ListDrafts } from './types';

/** Fetches a URL from Preview CAPI, signing the request. */
type FetchPreview = (url: string) => Promise<globalThis.Response>;

const noAccessMessage =
	"You don't have permission to access the affiliate products tool.";

/**
 * Lists a stage's articles from its CAPI, and its drafts from its Preview CAPI if it can
 * be read, linking to its Composer, with their prices from its pricing table, read on
 * every request so nothing is cached between them.
 */
const readStage = ({
	stage,
	capiKey,
	fetchPreview,
	dynamoService,
}: {
	stage: string;
	capiKey: string;
	fetchPreview?: FetchPreview;
	dynamoService: DynamoService;
}) => ({
	listDrafts: fetchPreview
		? createCapiDrafts({
				baseUrl: getPreviewCapiBaseUrl(stage),
				composerBaseUrl: getComposerBaseUrl(stage),
				fetchPreview,
			})
		: undefined,
	listArticles: createCapiArticles({
		baseUrl: getCapiBaseUrl(stage),
		apiKey: capiKey,
		composerBaseUrl: getComposerBaseUrl(stage),
	}),
	getArticle: createCapiArticle({
		baseUrl: getCapiBaseUrl(stage),
		apiKey: capiKey,
		composerBaseUrl: getComposerBaseUrl(stage),
	}),
	getProductPrices: createProductPrices((urls) =>
		dynamoService.getProductsByUrl(urls),
	),
});

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
 * listed when Preview CAPI can't be reached.
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

/**
 * Serves the affiliate-products-client build and its API from a single origin,
 * so the page and the API sit behind the same auth middleware.
 */
export function createApp({
	clientDir,
	auth,
	stage,
	capiKey,
	fetchPreview,
	dynamoService,
	prod,
	fetchPage = fetchRenderedPage,
}: {
	clientDir: string;
	auth: Auth;
	/** The stage whose CAPI, Composer and pricing table the articles come from by default. */
	stage: string;
	capiKey: string;
	/** Fetches from the stage's Preview CAPI, for its drafts. Without it, no drafts are listed. */
	fetchPreview?: FetchPreview;
	dynamoService: DynamoService;
	/** PROD's CAPI key, Preview CAPI and pricing table, used instead when asked for with prod=true. */
	prod?: {
		capiKey: string;
		fetchPreview?: FetchPreview;
		dynamoService: DynamoService;
	};
	/** Fetches an article as it's rendered on the site, for its links. */
	fetchPage?: typeof fetchRenderedPage;
}) {
	const app = express();
	app.use(express.json());

	const stageData = readStage({ stage, capiKey, fetchPreview, dynamoService });
	const prodData = prod && readStage({ stage: 'PROD', ...prod });

	app.use(async (req, res, next) => {
		const isApiRequest = req.path.startsWith('/api/');

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
		// An article's URL or path, to show just that article rather than a page of them.
		const { path: pathParam } = req.query;
		const path =
			typeof pathParam === 'string' ? articlePath(pathParam) : undefined;
		if (pathParam !== undefined && !path) {
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
		// The drafts come before the live articles, so they're only on the first page.
		const showDrafts =
			!path &&
			(status.data === 'draft' || (status.data === undefined && page === '1'));
		const showLive = status.data !== 'draft';
		const [drafts, livePage] = await Promise.all([
			showDrafts
				? readDrafts(dataSource.listDrafts, section.data)
				: Promise.resolve(undefined),
			path
				? findArticle(dataSource.getArticle, path)
				: showLive
					? dataSource.listArticles(Number(page), section.data)
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

	// Read from the rendered page, as Skimlinks only wraps links when an article is rendered.
	const readArticlePage = async (
		req: Request,
		res: Response,
		respond: (page: { html: string; url: string }) => void,
	) => {
		const { url } = req.query;
		const pageUrl = typeof url === 'string' ? renderedPageUrl(url) : undefined;
		if (!pageUrl) {
			res.status(400).json({ error: "url must be an article's web URL" });
			return;
		}
		let page;
		try {
			page = await fetchPage(pageUrl);
		} catch (error) {
			console.error(error);
			res.status(502).json({ error: "The article's page couldn't be read" });
			return;
		}
		respond(page);
	};

	app.get('/api/link-counts', (req, res) =>
		readArticlePage(req, res, ({ html, url }) => {
			const counts: LinkCounts = countLinks(html, url);
			res.json(counts);
		}),
	);

	app.get('/api/link-counts.csv', (req, res) =>
		readArticlePage(req, res, ({ html, url }) => {
			const shortTitle =
				new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'article';
			res.attachment(`${shortTitle}-links.csv`);
			res.type('text/csv; charset=utf-8');
			res.send(linksCsv(html, url));
		}),
	);

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
