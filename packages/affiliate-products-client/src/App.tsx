import { css, Global } from '@emotion/react';
import { space, textSans15 } from '@guardian/source/foundations';
import { InlineError, Spinner } from '@guardian/source/react-components';
import { useEffect, useState } from 'react';
import { fetchArticles } from './api/articles';
import { fetchUserName } from './api/auth';
import { ArticleList } from './ArticleList';
import { useListParams } from './hooks/useListParams';
import { Pagination } from './Pagination';
import { Sidebar } from './Sidebar';
import { toolPalette } from './style';
import { TopToolbar } from './TopToolbar';
import type { ArticlesState, ListParams } from './types';

const globalStyles = css`
	body {
		${textSans15};
		margin: 0;
		color: ${toolPalette.text};
		background-color: #fff;
	}
`;

const bodyStyles = css`
	display: flex;
	align-items: flex-start;
`;

const mainStyles = css`
	flex: 1 1 auto;
	min-width: 0;
	padding: 0 ${space[4]}px;
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
				return <Spinner size="small" />;
			case 'unauthenticated':
				return (
					<p>
						Your login has expired.{' '}
						<a href={`${window.location.pathname}${window.location.search}`}>
							Reload the page
						</a>{' '}
						to log in again.
					</p>
				);
			case 'error':
				return <InlineError>Could not load articles.</InlineError>;
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
			<TopToolbar userName={userName} />
			<div css={bodyStyles}>
				<Sidebar
					section={section}
					onSectionChange={setSection}
					prod={prod}
					onProdChange={setProd}
				/>
				<main css={mainStyles}>{renderArticles()}</main>
			</div>
		</>
	);
};
