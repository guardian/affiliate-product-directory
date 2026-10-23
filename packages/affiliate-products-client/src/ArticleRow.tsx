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
import { ComposerIcon, LiveSiteIcon, OphanIcon, SkimlinksIcon } from './icons';
import { retailerLinkCount } from './productStats';
import { describeSection } from './sections';
import { skimlinksUrl } from './skimlinksUrl';
import { accent, draftAccent, livePricingAccent } from './style';

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
		${toggleColumnWidth} minmax(0, 1fr)
		10rem 5.5rem 7rem 7rem;
	align-items: center;
	column-gap: ${semanticSpacing.stackSm};
	padding: 0 ${semanticSpacing.stackXs};

	& [data-when] {
		display: none;
	}

	@container ${listContainer} (max-width: 64rem) {
		grid-template-columns:
			${toggleColumnWidth} minmax(0, 1fr)
			5.5rem 7rem 7rem;

		& > [data-column='byline'] {
			display: none;
		}

		& [data-when~='medium'] {
			display: inline;
		}
	}

	@container ${listContainer} (max-width: 44rem) {
		grid-template-columns: ${toggleColumnWidth} minmax(0, 1fr) 7rem;

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

/** The products column: how many products, and under it how many links to their retailers. */
const countsStyles = css`
	font-variant-numeric: tabular-nums;
`;

// The whole row opens the article, and an open row is marked with a bar
// down its left edge. A draft's row is tinted, with a stripe of its own until it's opened,
// and so is the row of an article with live pricing, without one.
const summaryStyles = (
	expanded: boolean,
	draft: boolean,
	livePricing: boolean,
) => css`
	${articleColumnsStyles};
	${convertTypographyToEmotionStringStyle(semanticTypography.bodySm)};
	padding-top: ${semanticSpacing.stackXs};
	padding-bottom: ${semanticSpacing.stackXs};
	cursor: pointer;
	background-color: ${expanded
		? semanticColors.bg.raisedLevel2
		: draft
			? draftAccent.tint
			: livePricing
				? livePricingAccent.tint
				: 'transparent'};
	box-shadow: ${expanded
		? `inset 4px 0 0 ${accent.strong}`
		: draft
			? `inset 4px 0 0 ${draftAccent.stripe}`
			: 'none'};

	&:hover {
		background-color: ${expanded
			? semanticColors.bg.raisedLevel2
			: draft
				? draftAccent.tintHover
				: livePricing
					? livePricingAccent.tintHover
					: semanticColors.bg.raisedLevel1};
	}
`;

const draftBadgeStyles = css`
	margin-right: ${semanticSpacing.stackXs};
	vertical-align: text-bottom;
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

// The icons' padding spaces them out, so their hover areas meet. The margin lines the first
// icon up with the column's heading.
const iconPadding = '6px';

const linksStyles = css`
	display: flex;
	align-items: center;
	margin: 0 -${iconPadding};
`;

// Plain icons, rather than Stand's IconLinkButtons, so the four fit the column.
const iconLinkStyles = (available: boolean) => css`
	display: flex;
	width: 14px;
	height: 14px;
	box-sizing: content-box;
	padding: ${iconPadding};
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
		<ArticleLink
			href={
				article.webUrl &&
				skimlinksUrl(article.webUrl, article.webPublicationDate)
			}
			name="View in Skimlinks"
			icon={<SkimlinksIcon />}
		/>
	</div>
);

// In front of the article's path, as the list has no column for the section. Smaller than
// Stand's smallest badge, with even padding (its own is 1px above and 3px below), and on
// the path's baseline.
const sectionStyles = (colour: string) => css`
	margin-right: ${semanticSpacing.stackXxs};
	padding: 2px 4px;
	font-size: 0.625rem;
	line-height: 1;
	letter-spacing: 0.02em;
	vertical-align: baseline;
	border-radius: 2px;
	background-color: ${colour};
	color: ${semanticColors.text.strongerInverse};
`;

const weakText = { color: semanticColors.text.weak };

const weakTextStyles = css`
	color: ${semanticColors.text.weak};
`;

/** When the article was published, or for a draft, when it was last modified. */
const ArticleDate = ({ article }: { article: Article }) =>
	article.webPublicationDate ? (
		<time dateTime={article.webPublicationDate}>
			{formatDate(article.webPublicationDate)}
		</time>
	) : (
		<span css={weakTextStyles}>
			{article.lastModified ? (
				<>
					Modified{' '}
					<time dateTime={article.lastModified}>
						{formatDate(article.lastModified)}
					</time>
				</>
			) : (
				'Unpublished'
			)}
		</span>
	);

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
	const draft = article.status === 'draft';

	// Clicks on the row's links and toggle do what they do without the row's click too.
	const onRowClick = (event: MouseEvent) => {
		if (!(event.target as Element).closest('a, button')) {
			setExpanded(!expanded);
		}
	};

	return (
		<li css={rowStyles(expanded)}>
			{/* The toggle makes the row's click usable from the keyboard. */}
			<div
				css={summaryStyles(expanded, draft, article.livePricing)}
				onClick={onRowClick}
			>
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
					<div css={titleStyles}>
						{draft && (
							<Badge size="xs" color="yellow" cssOverrides={draftBadgeStyles}>
								Draft
							</Badge>
						)}
						{article.webTitle}
					</div>
					<Typography
						element="div"
						variant="bodyXs"
						theme={weakText}
						cssOverrides={ellipsisStyles}
					>
						<Badge size="xs" cssOverrides={sectionStyles(section.colour)}>
							{section.name}
						</Badge>
						/{article.id}
					</Typography>
					{/* The byline and date, here when their columns are left out of a narrow list. */}
					<Typography element="div" variant="bodyXs" theme={weakText}>
						{article.byline && (
							<span data-when="medium narrow">{article.byline}</span>
						)}
						<span data-when="narrow">
							{article.byline && ' · '}
							<ArticleDate article={article} />
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
				<div css={countsStyles}>
					{article.products.length}
					<Typography element="div" variant="bodyXs" theme={weakText}>
						{retailerLinkCount(article)}{' '}
						{retailerLinkCount(article) === 1 ? 'link' : 'links'}
					</Typography>
				</div>
				<span data-column="published">
					<ArticleDate article={article} />
				</span>
			</div>
			{expanded && <ArticleDetail id={panelId} article={article} />}
		</li>
	);
};
