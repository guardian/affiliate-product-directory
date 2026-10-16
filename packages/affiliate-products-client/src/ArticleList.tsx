import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import { articleColumnsStyles, ArticleRow } from './ArticleRow';

const listStyles = css`
	list-style: none;
	margin: 0;
	padding: 0;
`;

const headerStyles = css`
	${articleColumnsStyles};
	${convertTypographyToEmotionStringStyle(semanticTypography.headingXs)};
	padding: ${semanticSpacing.stackXs} 0;
	border-bottom: 2px solid ${semanticColors.border.strong};
	color: ${semanticColors.text.weak};
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
