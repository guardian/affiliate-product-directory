import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import { palette, space, textSansBold14 } from '@guardian/source/foundations';
import { articleColumnsStyles, ArticleRow } from './ArticleRow';

const listStyles = css`
	list-style: none;
	margin: 0;
	padding: 0;
`;

const headerStyles = css`
	${articleColumnsStyles};
	${textSansBold14};
	padding: ${space[2]}px 0;
	border-bottom: 2px solid ${palette.neutral[60]};
	color: ${palette.neutral[46]};
`;

const ArticleListHeader = () => (
	<div css={headerStyles}>
		<span />
		<span>Article</span>
		<span>Links</span>
		<span>Section</span>
		<span>Published</span>
	</div>
);

/** The column headers and a row for each of the given articles. */
export const ArticleList = ({ articles }: { articles: Article[] }) => (
	<>
		<ArticleListHeader />
		<ul css={listStyles}>
			{articles.map((article) => (
				<ArticleRow key={article.id} article={article} />
			))}
		</ul>
	</>
);
