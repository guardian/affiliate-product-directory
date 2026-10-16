import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import {
	articleColumnsStyles,
	articleListContainer,
	ArticleRow,
	numberColumnStyles,
} from './ArticleRow';

const listStyles = css`
	list-style: none;
	margin: 0;
	padding: 0;
`;

// Like the POC, the header is a shaded bar above the rows.
const headerStyles = css`
	${articleColumnsStyles};
	${convertTypographyToEmotionStringStyle(semanticTypography.headingXs)};
	min-height: 3rem;
	border-bottom: 1px solid ${semanticColors.border.strong};
	background-color: ${semanticColors.bg.raisedLevel2};
	color: ${semanticColors.text.weak};
	white-space: nowrap;
`;

const ArticleListHeader = () => (
	<div css={headerStyles}>
		<span />
		<span>Headline</span>
		<span data-column="byline">Byline</span>
		<span data-column="open-in">Open in</span>
		<span>Section</span>
		<span css={numberColumnStyles}>Products</span>
		<span data-column="retailer-links" css={numberColumnStyles}>
			Retailer links
		</span>
		<span data-column="published">Published</span>
	</div>
);

/** The column headers and a row for each of the given articles. */
export const ArticleList = ({
	articles,
	initiallyOpen = false,
}: {
	articles: Article[];
	/** Whether the articles start open, as one that's been searched for does. */
	initiallyOpen?: boolean;
}) => (
	<div css={articleListContainer}>
		<ArticleListHeader />
		<ul css={listStyles}>
			{articles.map((article) => (
				<ArticleRow
					key={article.id}
					article={article}
					initiallyOpen={initiallyOpen}
				/>
			))}
		</ul>
	</div>
);

// Grey bars where a row's text will be, at about its height, so the list doesn't jump
// when the articles arrive.
const placeholderRowStyles = css`
	${articleColumnsStyles};
	min-height: 4.5rem;
	border-bottom: 1px solid ${semanticColors.border.weak};
`;

const barStyles = (width: string, height = '0.75rem') => css`
	display: block;
	width: ${width};
	height: ${height};
	border-radius: ${semanticRadius.cornerSm};
	background-color: ${semanticColors.bg.raisedLevel2};

	@media (prefers-reduced-motion: no-preference) {
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
`;

const headlineBarsStyles = css`
	display: grid;
	gap: ${semanticSpacing.stackXxs};
`;

const visuallyHidden = css`
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
`;

// Varied so the placeholder looks like a list of headlines rather than a grid.
const headlineWidths = ['85%', '70%', '92%', '64%', '78%', '88%', '60%', '74%'];

/** The column headers with grey placeholder rows, while a page of articles loads. */
export const ArticleListPlaceholder = () => (
	<div css={articleListContainer} aria-busy="true">
		<span css={visuallyHidden} role="status">
			Loading articles…
		</span>
		<ArticleListHeader />
		{headlineWidths.map((width, index) => (
			<div key={index} css={placeholderRowStyles} aria-hidden="true">
				<span />
				<span css={headlineBarsStyles}>
					<span css={barStyles(width, '1rem')} />
					<span css={barStyles('45%')} />
				</span>
				<span data-column="byline" css={barStyles('70%')} />
				<span data-column="open-in" css={barStyles('4rem')} />
				<span css={barStyles('5rem', '1.1rem')} />
				<span css={[numberColumnStyles, barStyles('1.5rem')]} />
				<span
					data-column="retailer-links"
					css={[numberColumnStyles, barStyles('1.5rem')]}
				/>
				<span data-column="published" css={barStyles('5rem')} />
			</div>
		))}
	</div>
);
