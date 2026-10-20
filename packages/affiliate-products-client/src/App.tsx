import type { Article } from '@common/tool-models';
import { css, Global } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
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
import { fetchUserName } from './api/auth';
import { ArticleList, ArticleListPlaceholder } from './ArticleList';
import type { ArticleGroup } from './ArticleList';
import { headlineInset } from './ArticleRow';
import { ArticleSearch } from './ArticleSearch';
import { useListParams } from './hooks/useListParams';
import { Pagination } from './Pagination';
import { PriceEditingContext } from './PriceEditing';
import { Sidebar } from './Sidebar';
import { TopToolbar } from './TopToolbar';
import type { ArticlesState, ListParams } from './types';

const globalStyles = css`
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
		prod,
		path,
		setPage,
		setSection,
		setStatus,
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
	const priceEditing = useMemo(
		() => ({ canEdit: !prod, onPriceEdit: () => setReloads((n) => n + 1) }),
		[prod],
	);

	useEffect(() => {
		// The name is only shown in the toolbar, so there's nothing to show if this fails.
		fetchUserName()
			.then(setUserName)
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		const params = { page, section, status, prod, path };
		fetchArticles(params, controller.signal)
			.then((state) => setFetched({ params, state }))
			.catch(() => {
				if (!controller.signal.aborted) {
					setFetched({ params, state: { status: 'error' } });
				}
			});
		return () => controller.abort();
	}, [page, section, status, prod, path, reloads]);

	// Whatever was fetched last is for a previous view until the current one's articles arrive.
	const articles: ArticlesState =
		fetched?.params.page === page &&
		fetched.params.section === section &&
		fetched.params.status === status &&
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
					...(status !== 'live' && page === 1
						? [
								{
									title: drafts ? `Drafts (${drafts.length})` : 'Drafts',
									draft: true,
									articles: drafts ?? [],
									emptyMessage: drafts
										? 'There are no drafts.'
										: 'Drafts aren’t available yet.',
								},
							]
						: []),
					...(status !== 'draft'
						? [
								{
									title: `Published (${total})`,
									draft: false,
									articles: articles.page.articles,
									emptyMessage: 'There are no published articles.',
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

	return (
		<>
			<Global styles={globalStyles} />
			<Layout>
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
					prod={prod}
					onProdChange={setProd}
				/>
				<Layout.Main paddingTop={false} cssOverrides={mainStyles}>
					<PriceEditingContext.Provider value={priceEditing}>
						{renderArticles()}
					</PriceEditingContext.Provider>
				</Layout.Main>
			</Layout>
		</>
	);
};
