import { css, Global } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { InlineMessage } from '@guardian/stand/InlineMessage';
import { Layout } from '@guardian/stand/Layout';
import { Link } from '@guardian/stand/Link';
import { Typography } from '@guardian/stand/Typography';
import {
	convertTypographyToEmotionStringStyle,
	GlobalResetStyles,
} from '@guardian/stand/utils';
import { useEffect, useState } from 'react';
import { fetchArticles } from './api/articles';
import { fetchUserName } from './api/auth';
import { ArticleList } from './ArticleList';
import { useListParams } from './hooks/useListParams';
import { Pagination } from './Pagination';
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

const mainStyles = css`
	min-width: 0;
	padding-left: ${semanticSpacing.stackMd};
	padding-right: ${semanticSpacing.stackMd};
`;

export const App = () => {
	const [userName, setUserName] = useState<string>();
	const { page, section, prod, setPage, setSection, setProd } = useListParams();
	const [fetched, setFetched] = useState<{
		params: ListParams;
		state: ArticlesState;
	}>();

	useEffect(() => {
		// The name is only shown in the toolbar, so there's nothing to show if this fails.
		fetchUserName()
			.then(setUserName)
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		const params = { page, section, prod };
		fetchArticles(params, controller.signal)
			.then((state) => setFetched({ params, state }))
			.catch(() => {
				if (!controller.signal.aborted) {
					setFetched({ params, state: { status: 'error' } });
				}
			});
		return () => controller.abort();
	}, [page, section, prod]);

	// Whatever was fetched last is for a previous view until the current one's articles arrive.
	const articles: ArticlesState =
		fetched?.params.page === page &&
		fetched.params.section === section &&
		fetched.params.prod === prod
			? fetched.state
			: { status: 'loading' };

	const changePage = (newPage: number) => {
		setPage(newPage);
		window.scrollTo(0, 0);
	};

	const renderArticles = () => {
		switch (articles.status) {
			case 'loading':
				return (
					<Typography element="p" variant="bodyMd">
						Loading articles…
					</Typography>
				);
			case 'unauthenticated':
				return (
					<InlineMessage level="information">
						Your login has expired.{' '}
						<Link
							href={`${window.location.pathname}${window.location.search}`}
							typography="bodyMd"
						>
							Reload the page
						</Link>{' '}
						to log in again.
					</InlineMessage>
				);
			case 'error':
				return (
					<InlineMessage level="error">Could not load articles.</InlineMessage>
				);
			case 'loaded':
				return (
					<>
						<Pagination page={articles.page} onChange={changePage} />
						<ArticleList articles={articles.page.articles} />
						<Pagination page={articles.page} onChange={changePage} />
					</>
				);
		}
	};

	return (
		<>
			<Global styles={globalStyles} />
			<Layout>
				<Layout.TopBar>
					<TopToolbar userName={userName} />
				</Layout.TopBar>
				<Sidebar
					section={section}
					onSectionChange={setSection}
					prod={prod}
					onProdChange={setProd}
				/>
				<Layout.Main paddingTop={false} cssOverrides={mainStyles}>
					{renderArticles()}
				</Layout.Main>
			</Layout>
		</>
	);
};
