import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticColors, semanticSpacing } from '@guardian/stand';
import { Badge } from '@guardian/stand/Badge';
import { IconButton } from '@guardian/stand/IconButton';
import { IconLinkButton } from '@guardian/stand/IconLinkButton';
import { Link } from '@guardian/stand/Link';
import { Typography } from '@guardian/stand/Typography';
import { type ReactNode, useId, useState } from 'react';
import { formatDate } from './formatDate';
import { ComposerIcon, LiveSiteIcon, OphanIcon } from './icons';
import { ProductList } from './ProductList';
import { describeSection } from './sections';

// The width of the column with the row's toggle, which is a small IconButton.
const toggleColumnWidth = '2rem';

const rowStyles = css`
	border-bottom: 1px solid ${semanticColors.border.weak};
`;

/**
 * The columns of each row, shared with the list's header row. Each row is its own grid,
 * so the columns have fixed widths for the rows and header to line up.
 */
export const articleColumnsStyles = css`
	display: grid;
	grid-template-columns: ${toggleColumnWidth} minmax(0, 1fr) 5rem 7.5rem 7.5rem;
	align-items: center;
	column-gap: ${semanticSpacing.stackSm};
`;

const summaryStyles = css`
	${articleColumnsStyles};
	padding: ${semanticSpacing.stackXs} 0;

	&:hover {
		background-color: ${semanticColors.bg.raisedLevel1};
	}
`;

const toggleStyles = (expanded: boolean) => css`
	.material-symbols {
		transform: rotate(${expanded ? 180 : 0}deg);
		transition: transform 0.15s;
	}
`;

const titleStyles = css`
	text-decoration: none;

	&[data-hovered] {
		text-decoration: underline;
	}
`;

const pathStyles = css`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const linksStyles = css`
	display: flex;
	align-items: center;
	gap: ${semanticSpacing.stackXxs};
`;

/** An unavailable link is shown disabled rather than left out, to keep the columns aligned. */
const ArticleLink = ({
	href,
	name,
	icon,
}: {
	href?: string;
	name: string;
	icon: ReactNode;
}) => (
	<IconLinkButton
		href={href}
		isDisabled={!href}
		target="_blank"
		rel="noreferrer"
		variant="tertiary"
		size="xs"
		ariaLabel={href ? `${name} (opens in new window)` : `${name} (unavailable)`}
	>
		{icon}
	</IconLinkButton>
);

const ArticleLinks = ({ article }: { article: Article }) => (
	<div css={linksStyles}>
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

// The products table takes the row's full width.
const panelStyles = css`
	padding: ${semanticSpacing.stackXs} 0 ${semanticSpacing.stackMd};
`;

export const ArticleRow = ({ article }: { article: Article }) => {
	const [expanded, setExpanded] = useState(false);
	const panelId = useId();
	const section = describeSection(article.sectionId);

	return (
		<li css={rowStyles}>
			<div css={summaryStyles}>
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
					<Link
						href={article.webUrl}
						target="_blank"
						rel="noreferrer"
						typography="bodyBoldMd"
						cssOverrides={titleStyles}
					>
						{article.webTitle}
					</Link>
					<Typography
						element="div"
						variant="bodyXs"
						theme={{ color: semanticColors.text.weak }}
						cssOverrides={pathStyles}
					>
						/{article.id}
					</Typography>
				</div>
				<ArticleLinks article={article} />
				<Badge size="xs" cssOverrides={sectionStyles(section.colour)}>
					{section.name}
				</Badge>
				<Typography variant="bodySm">
					<time dateTime={article.webPublicationDate}>
						{formatDate(article.webPublicationDate)}
					</time>
				</Typography>
			</div>
			{expanded && (
				<div id={panelId} css={panelStyles}>
					<ProductList products={article.products} />
				</div>
			)}
		</li>
	);
};
