import type { Article } from '@common/tool-models';
import { css, Global } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { AlertBanner } from '@guardian/stand/AlertBanner';
import { Button } from '@guardian/stand/Button';
import { InlineMessage } from '@guardian/stand/InlineMessage';
import { Layout } from '@guardian/stand/Layout';
import { LinkButton } from '@guardian/stand/LinkButton';
import {
	convertTypographyToEmotionStringStyle,
	GlobalResetStyles,
} from '@guardian/stand/utils';
import { useEffect, useMemo, useState } from 'react';
import { fetchArticles } from './api/articles';
import { fetchCanEditProdPrices, fetchUserName } from './api/auth';
import { ArticleList, ArticleListPlaceholder } from './ArticleList';
import type { ArticleGroup } from './ArticleList';
import { headlineInset } from './ArticleRow';
import { ArticleSearch } from './ArticleSearch';
import { useListParams } from './hooks/useListParams';
import { useStarred } from './hooks/useStarred';
import { useStarredArticles } from './hooks/useStarredArticles';
import { Pagination } from './Pagination';
import { PriceEditingContext } from './PriceEditing';
import { isProd, ProdDataContext } from './ProdData';
import { Sidebar } from './Sidebar';
import { StarredContext } from './Starred';
import { TopToolbar } from './TopToolbar';
import type { ArticlesState, ListParams } from './types';

export const globalStyles = css`
	${GlobalResetStyles};

	/* Stand's title typography is set in the bold Guardian Headline. */
	@font-face {
		font-family: 'GH Guardian Headline';
		src: url('https://assets.guim.co.uk/static/frontend/fonts/guardian-headline/full-not-hinted/GHGuardianHeadline-Bold.woff2')
			format('woff2');
		font-weight: 700;
		font-style: normal;
		font-display: swap;
	}

	body {
		${convertTypographyToEmotionStringStyle(semanticTypography.bodyMd)};
		margin: 0;
		color: ${semanticColors.text.strong};
		background-color: ${semanticColors.bg.base};
	}
`;

const messageStyles = css`
	display: grid;
	justify-items: start;
	gap: ${semanticSpacing.stackMd};
	max-width: 40rem;
	padding: ${semanticSpacing.stackLg} ${semanticSpacing.stackMd};
	padding-left: ${headlineInset};
`;

const forbiddenPageStyles = css`
	box-sizing: border-box;
	min-height: 100vh;
	padding: ${semanticSpacing.stackLg} ${semanticSpacing.stackMd};
	background-color: #f6f6f6;
`;

// Below a found article, where the pagination is below the list.
const afterFoundStyles = css`
	padding: ${semanticSpacing.stackLg} ${semanticSpacing.stackMd};
	padding-left: ${headlineInset};
`;

const mainStyles = css`
	min-width: 0;
	padding: 0;
`;

export const App = () => {
	const [userName, setUserName] = useState<string>();
	const {
		page,
		section,
		status,
		livePricing,
		prod,
		path,
		setPage,
		setSection,
		setStatus,
		setLivePricing,
		setProd,
		setPath,
	} = useListParams();
	const [fetched, setFetched] = useState<{
		params: ListParams;
		state: ArticlesState;
	}>();
	// Bumped to fetch the list again after a price is set, keeping the current one on screen
	// (and its open articles open) until the new one arrives.
	const [reloads, setReloads] = useState(0);
	// PROD's prices can only be set from here while their switch is on.
	const [canEditProdPrices, setCanEditProdPrices] = useState(false);
	const priceEditing = useMemo(
		() => ({
			canEdit: !prod || canEditProdPrices,
			onPriceEdit: () => setReloads((n) => n + 1),
		}),
		[prod, canEditProdPrices],
	);

	const { starred, toggleStar } = useStarred(prod);
	const starredContext = {
		isStarred: (id: string) => starred.includes(id),
		toggleStar,
	};
	const {
		articles: starredArticles,
		failed: starredFailed,
		retry: retryStarred,
	} = useStarredArticles(starred, prod, reloads);

	// The starred articles the sidebar's filters would show, in the order they were starred.
	const pinned =
		starredArticles &&
		starred.flatMap((id) => {
			const article = starredArticles.get(id);
			return article &&
				(!section || article.sectionId === section) &&
				(!status || article.status === status) &&
				(!livePricing || article.livePricing)
				? [article]
				: [];
		});

	useEffect(() => {
		// The name is only shown in the toolbar, so there's nothing to show if this fails.
		fetchUserName()
			.then(setUserName)
			.catch(() => undefined);
		fetchCanEditProdPrices()
			.then(setCanEditProdPrices)
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		const params = { page, section, status, livePricing, prod, path };
		fetchArticles(params, controller.signal)
			.then((state) => setFetched({ params, state }))
			.catch(() => {
				if (!controller.signal.aborted) {
					setFetched({ params, state: { status: 'error' } });
				}
			});
		return () => controller.abort();
	}, [page, section, status, livePricing, prod, path, reloads]);

	// Whatever was fetched last is for a previous view until the current one's articles arrive.
	const articles: ArticlesState =
		fetched?.params.page === page &&
		fetched.params.section === section &&
		fetched.params.status === status &&
		fetched.params.livePricing === livePricing &&
		fetched.params.prod === prod &&
		fetched.params.path === path
			? fetched.state
			: { status: 'loading' };

	const changePage = (newPage: number) => {
		setPage(newPage);
		window.scrollTo(0, 0);
	};

	const showAllButton = (
		<Button variant="secondary" size="sm" onPress={() => setPath(undefined)}>
			Show all articles
		</Button>
	);

	// The article searched for, open, or a message if there isn't one at that path.
	const renderFound = (found: Article[]) =>
		found.length === 0 ? (
			<div css={messageStyles}>
				<InlineMessage level="information">
					There’s no article at /{path}
					{prod ? ' in PROD' : ''}. Check the URL, or that it has been
					published.
				</InlineMessage>
				{showAllButton}
			</div>
		) : (
			<>
				<ArticleList articles={found} initiallyOpen={true} />
				<div css={afterFoundStyles}>{showAllButton}</div>
			</>
		);

	const renderArticles = () => {
		switch (articles.status) {
			case 'loading':
				return <ArticleListPlaceholder />;
			case 'unauthenticated':
				return (
					<div css={messageStyles}>
						<InlineMessage level="information">
							Your login has expired, so the articles can’t be loaded.
						</InlineMessage>
						<LinkButton
							href={`${window.location.pathname}${window.location.search}`}
							size="sm"
						>
							Log in again
						</LinkButton>
					</div>
				);
			case 'forbidden':
				return null;
			case 'error':
				return (
					<div css={messageStyles}>
						<InlineMessage level="error">
							The articles couldn’t be loaded. The tool may not be able to reach
							CAPI or the pricing table right now.
						</InlineMessage>
						<Button size="sm" onPress={() => setReloads((n) => n + 1)}>
							Try again
						</Button>
					</div>
				);
			case 'loaded': {
				if (path) {
					return renderFound(articles.page.articles);
				}
				const { drafts, total } = articles.page;
				// The drafts are only on the first page. The server leaves them out of it when
				// it can't list them, which it can't yet, as they're only in Preview CAPI.
				const groups: ArticleGroup[] = [
					// Pinned above everything else on the first page, and in their place below too.
					...(page === 1 && starred.length > 0
						? [
								{
									title: pinned ? `Starred (${pinned.length})` : 'Starred',
									kind: 'starred' as const,
									articles: pinned ?? [],
									emptyMessage: pinned
										? 'No starred articles match these filters.'
										: 'Loading the starred articles…',
									notice:
										starredFailed.length > 0 ? (
											<>
												{starredFailed.length === 1
													? '1 starred article'
													: `${starredFailed.length} starred articles`}{' '}
												couldn’t be loaded.{' '}
												<Button
													variant="secondary"
													size="xs"
													onPress={retryStarred}
												>
													Try again
												</Button>
											</>
										) : undefined,
								},
							]
						: []),
					...(status !== 'live' && page === 1
						? [
								{
									title: drafts ? `Drafts (${drafts.length})` : 'Drafts',
									kind: 'drafts' as const,
									articles: drafts ?? [],
									// Live prices are only shown in published articles.
									emptyMessage: livePricing
										? 'Live pricing is only listed for published articles.'
										: drafts
											? 'There are no drafts.'
											: 'Drafts aren’t available yet.',
								},
							]
						: []),
					...(status !== 'draft'
						? [
								{
									title: `Published (${total})`,
									kind: 'published' as const,
									articles: articles.page.articles,
									emptyMessage: livePricing
										? 'There are no published articles with live pricing.'
										: 'There are no published articles.',
								},
							]
						: []),
				];
				return (
					<>
						<ArticleList groups={groups} />
						{status !== 'draft' && (
							<Pagination page={articles.page} onChange={changePage} />
						)}
					</>
				);
			}
		}
	};

	if (articles.status === 'forbidden') {
		return (
			<>
				<Global styles={globalStyles} />
				<main css={forbiddenPageStyles}>
					<InlineMessage level="error">
						Your account doesn’t have access to the affiliate products tool.
					</InlineMessage>
				</main>
			</>
		);
	}

	return (
		<>
			<Global styles={globalStyles} />
			<Layout>
				{!isProd && (
					<Layout.AlertBanner>
						<AlertBanner level="warning" showIcon={true}>
							You are working in the CODE Environment
						</AlertBanner>
					</Layout.AlertBanner>
				)}
				<Layout.TopBar>
					<TopToolbar
						userName={userName}
						search={
							<ArticleSearch key={path ?? ''} path={path} onSearch={setPath} />
						}
					/>
				</Layout.TopBar>
				<Sidebar
					section={section}
					onSectionChange={setSection}
					status={status}
					onStatusChange={setStatus}
					livePricing={livePricing}
					onLivePricingChange={setLivePricing}
					prod={prod}
					onProdChange={setProd}
				/>
				<Layout.Main paddingTop={false} cssOverrides={mainStyles}>
					<ProdDataContext.Provider value={prod}>
						<PriceEditingContext.Provider value={priceEditing}>
							<StarredContext.Provider value={starredContext}>
								{renderArticles()}
							</StarredContext.Provider>
						</PriceEditingContext.Provider>
					</ProdDataContext.Provider>
				</Layout.Main>
			</Layout>
		</>
	);
};
