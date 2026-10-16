import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { Badge } from '@guardian/stand/Badge';
import { IconButton } from '@guardian/stand/IconButton';
import { Typography } from '@guardian/stand/Typography';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import { type MouseEvent, type ReactNode, useId, useState } from 'react';
import { ArticleDetail } from './ArticleDetail';
import { formatDate } from './formatDate';
import { ComposerIcon, LiveSiteIcon, OphanIcon } from './icons';
import { retailerLinkCount } from './productStats';
import { describeSection } from './sections';
import { accent } from './style';

// The width of the column with the row's toggle, which is a small IconButton.
const toggleColumnWidth = '2rem';

const rowStyles = (expanded: boolean) => css`
	border-bottom: ${expanded
		? `2px solid ${accent.strong}`
		: `1px solid ${semanticColors.border.weak}`};
`;

/** The name of the container the list's rows size their columns by: see articleListContainer. */
const listContainer = 'article-list';

/** Makes an element the container that the rows inside it size their columns by. */
export const articleListContainer = css`
	container: ${listContainer} / inline-size;
`;

/**
 * The columns of each row, shared with the list's header row. Each row is its own grid,
 * so the columns have fixed widths for the rows and header to line up.
 *
 * In a narrower list, the less needed columns are left out, by their data-column, so the
 * headline keeps room to be read. What they showed moves under the headline instead, in
 * the elements whose data-when names that width.
 */
export const articleColumnsStyles = css`
	display: grid;
	grid-template-columns:
		${toggleColumnWidth} minmax(0, 1fr) 10rem 5.5rem 6.5rem 4.5rem 5.5rem
		7rem;
	align-items: center;
	column-gap: ${semanticSpacing.stackSm};
	padding: 0 ${semanticSpacing.stackXs};

	& [data-when] {
		display: none;
	}

	@container ${listContainer} (max-width: 64rem) {
		grid-template-columns:
			${toggleColumnWidth} minmax(0, 1fr)
			5.5rem 6.5rem 4.5rem 7rem;

		& > [data-column='byline'],
		& > [data-column='retailer-links'] {
			display: none;
		}

		& [data-when~='medium'] {
			display: inline;
		}
	}

	@container ${listContainer} (max-width: 44rem) {
		grid-template-columns: ${toggleColumnWidth} minmax(0, 1fr) 6.5rem 4.5rem;

		& > [data-column='open-in'],
		& > [data-column='published'] {
			display: none;
		}

		& [data-when~='narrow'] {
			display: inline;
		}
	}
`;

/** How far the headline column is from the row's left edge, for lining other things up with it. */
export const headlineInset = `calc(${semanticSpacing.stackXs} + ${toggleColumnWidth} + ${semanticSpacing.stackSm})`;

/** For the columns of counts, which line up on the right. */
export const numberColumnStyles = css`
	justify-self: end;
	font-variant-numeric: tabular-nums;
`;

// Like the POC, the whole row opens the article, and an open row is marked with a bar
// down its left edge.
const summaryStyles = (expanded: boolean) => css`
	${articleColumnsStyles};
	${convertTypographyToEmotionStringStyle(semanticTypography.bodySm)};
	padding-top: ${semanticSpacing.stackXs};
	padding-bottom: ${semanticSpacing.stackXs};
	cursor: pointer;
	background-color: ${expanded
		? semanticColors.bg.raisedLevel2
		: 'transparent'};
	box-shadow: ${expanded ? `inset 4px 0 0 ${accent.strong}` : 'none'};

	&:hover {
		background-color: ${expanded
			? semanticColors.bg.raisedLevel2
			: semanticColors.bg.raisedLevel1};
	}
`;

const toggleStyles = (expanded: boolean) => css`
	.material-symbols {
		transform: rotate(${expanded ? 180 : 0}deg);
		transition: transform 0.15s;
	}
`;

const titleStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.bodyBoldSm)};
	color: ${semanticColors.text.link};
`;

const ellipsisStyles = css`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const linksStyles = css`
	display: flex;
	align-items: center;
	gap: ${semanticSpacing.stackSm};
`;

// The POC's plain icons, rather than Stand's IconLinkButtons, so the three fit the column.
const iconLinkStyles = (available: boolean) => css`
	display: flex;
	width: 14px;
	height: 14px;
	color: ${available ? semanticColors.text.weak : semanticColors.text.disabled};

	svg {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}

	&:hover {
		color: ${available ? accent.strong : semanticColors.text.disabled};
	}
`;

/** An unavailable link is shown greyed out rather than left out, to keep the columns aligned. */
const ArticleLink = ({
	href,
	name,
	icon,
}: {
	href?: string;
	name: string;
	icon: ReactNode;
}) =>
	href ? (
		<a
			css={iconLinkStyles(true)}
			href={href}
			target="_blank"
			rel="noreferrer"
			title={`${name} (opens in new window)`}
			aria-label={`${name} (opens in new window)`}
		>
			{icon}
		</a>
	) : (
		<span
			css={iconLinkStyles(false)}
			title={`${name} (unavailable)`}
			aria-label={`${name} (unavailable)`}
			role="img"
		>
			{icon}
		</span>
	);

const ArticleLinks = ({ article }: { article: Article }) => (
	<div data-column="open-in" css={linksStyles}>
		<ArticleLink
			href={article.composerUrl}
			name="View in Composer"
			icon={<ComposerIcon />}
		/>
		<ArticleLink
			href={article.webUrl}
			name="View on Live site"
			icon={<LiveSiteIcon />}
		/>
		<ArticleLink
			href={article.ophanUrl}
			name="View in Ophan"
			icon={<OphanIcon />}
		/>
	</div>
);

const sectionStyles = (colour: string) => css`
	justify-self: start;
	white-space: nowrap;
	border-radius: 2px;
	background-color: ${colour};
	color: ${semanticColors.text.strongerInverse};
`;

const weakText = { color: semanticColors.text.weak };

export const ArticleRow = ({
	article,
	initiallyOpen = false,
}: {
	article: Article;
	initiallyOpen?: boolean;
}) => {
	const [expanded, setExpanded] = useState(initiallyOpen);
	const panelId = useId();
	const section = describeSection(article.sectionId);

	// Clicks on the row's links and toggle do what they do without the row's click too.
	const onRowClick = (event: MouseEvent) => {
		if (!(event.target as Element).closest('a, button')) {
			setExpanded(!expanded);
		}
	};

	return (
		<li css={rowStyles(expanded)}>
			{/* The toggle makes the row's click usable from the keyboard. */}
			<div css={summaryStyles(expanded)} onClick={onRowClick}>
				<IconButton
					variant="tertiary"
					size="sm"
					symbol="keyboard_arrow_down"
					ariaLabel={`Details for ${article.webTitle}`}
					aria-expanded={expanded}
					aria-controls={panelId}
					onPress={() => setExpanded(!expanded)}
					cssOverrides={toggleStyles(expanded)}
				/>
				<div>
					<div css={titleStyles}>{article.webTitle}</div>
					<Typography
						element="div"
						variant="bodyXs"
						theme={weakText}
						cssOverrides={ellipsisStyles}
					>
						/{article.id}
					</Typography>
					{/* The byline and date, here when their columns are left out of a narrow list. */}
					<Typography element="div" variant="bodyXs" theme={weakText}>
						{article.byline && (
							<span data-when="medium narrow">{article.byline}</span>
						)}
						<span data-when="narrow">
							{article.byline && ' · '}
							{formatDate(article.webPublicationDate)}
						</span>
					</Typography>
				</div>
				<div data-column="byline" css={ellipsisStyles} title={article.byline}>
					{article.byline ?? (
						<Typography variant="bodySm" theme={weakText}>
							—
						</Typography>
					)}
				</div>
				<ArticleLinks article={article} />
				<Badge size="xs" cssOverrides={sectionStyles(section.colour)}>
					{section.name}
				</Badge>
				<span css={numberColumnStyles}>{article.products.length}</span>
				<span data-column="retailer-links" css={numberColumnStyles}>
					{retailerLinkCount(article)}
				</span>
				<time data-column="published" dateTime={article.webPublicationDate}>
					{formatDate(article.webPublicationDate)}
				</time>
			</div>
			{expanded && <ArticleDetail id={panelId} article={article} />}
		</li>
	);
};
