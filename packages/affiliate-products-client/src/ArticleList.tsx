import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import { useId } from 'react';
import {
	articleColumnsStyles,
	articleListContainer,
	ArticleRow,
	headlineInset,
} from './ArticleRow';
import { draftAccent } from './style';

const listStyles = css`
	list-style: none;
	margin: 0;
	padding: 0;
`;

// Bigger than the rows' text, in Stand's condensed heading so the labels fit their columns.
// A label too long for its column, such as "Retailer links", wraps onto a second line.
const headerStyles = css`
	${articleColumnsStyles};
	${convertTypographyToEmotionStringStyle(semanticTypography.headingCompactMd)};
	min-height: 3rem;
	border-bottom: 1px solid ${semanticColors.border.strong};
	background-color: ${semanticColors.bg.raisedLevel2};
	color: ${semanticColors.text.weak};
`;

const ArticleListHeader = () => (
	<div css={headerStyles}>
		<span />
		<span>Headline</span>
		<span data-column="byline">Byline</span>
		<span data-column="open-in">Open in</span>
		<span>Products</span>
		<span data-column="published">Published</span>
	</div>
);

// Starts a group of rows, lined up with the headlines. The published articles' heading is
// also the divider between them and the drafts above.
const groupHeadingStyles = (kind: ArticleGroup['kind']) => css`
	${convertTypographyToEmotionStringStyle(semanticTypography.headingXs)};
	margin: 0;
	padding: ${semanticSpacing.stackXs} ${semanticSpacing.stackMd};
	padding-left: ${headlineInset};
	border-top: ${kind === 'published'
		? `3px solid ${semanticColors.border.strong}`
		: 'none'};
	border-bottom: 1px solid ${semanticColors.border.weak};
	background-color: ${kind === 'drafts'
		? draftAccent.tint
		: semanticColors.bg.raisedLevel1};
	color: ${semanticColors.text.weak};
	text-transform: uppercase;
`;

const emptyGroupStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.bodySm)};
	margin: 0;
	padding: ${semanticSpacing.stackSm} ${semanticSpacing.stackMd};
	padding-left: ${headlineInset};
	border-bottom: 1px solid ${semanticColors.border.weak};
	color: ${semanticColors.text.weak};
`;

const ArticleRows = ({
	articles,
	initiallyOpen,
}: {
	articles: Article[];
	initiallyOpen: boolean;
}) => (
	<ul css={listStyles}>
		{articles.map((article) => (
			<ArticleRow
				key={article.id}
				article={article}
				initiallyOpen={initiallyOpen}
			/>
		))}
	</ul>
);

/** A group of the list's rows under a heading of its own, such as the drafts. */
export interface ArticleGroup {
	title: string;
	kind: 'drafts' | 'published';
	articles: Article[];
	/** Shown in place of the rows when there are none. */
	emptyMessage: string;
}

const Group = ({
	group,
	initiallyOpen,
}: {
	group: ArticleGroup;
	initiallyOpen: boolean;
}) => {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId}>
			<h2 id={headingId} css={groupHeadingStyles(group.kind)}>
				{group.title}
			</h2>
			{group.articles.length === 0 ? (
				<p css={emptyGroupStyles}>{group.emptyMessage}</p>
			) : (
				<ArticleRows articles={group.articles} initiallyOpen={initiallyOpen} />
			)}
		</section>
	);
};

/**
 * The column headers and a row for each of the given articles, or, given groups, the rows
 * of each group under its heading.
 */
export const ArticleList = ({
	articles = [],
	groups,
	initiallyOpen = false,
}: {
	articles?: Article[];
	groups?: ArticleGroup[];
	/** Whether the articles start open, as one that's been searched for does. */
	initiallyOpen?: boolean;
}) => (
	<div css={articleListContainer}>
		<ArticleListHeader />
		{groups ? (
			groups.map((group) => (
				<Group key={group.kind} group={group} initiallyOpen={initiallyOpen} />
			))
		) : (
			<ArticleRows articles={articles} initiallyOpen={initiallyOpen} />
		)}
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
				<span data-column="open-in" css={barStyles('5rem')} />
				<span css={barStyles('5rem')} />
				<span data-column="published" css={barStyles('5rem')} />
			</div>
		))}
	</div>
);
