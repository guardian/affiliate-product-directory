import type { Article } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	palette,
	space,
	textSans12,
	textSans15,
	textSansBold12,
	textSansBold15,
} from '@guardian/source/foundations';
import { Link, SvgChevronDownSingle } from '@guardian/source/react-components';
import { type ReactNode, useId, useState } from 'react';
import { formatDate } from './formatDate';
import { ComposerIcon, LiveSiteIcon, OphanIcon } from './icons';
import { ProductList } from './ProductList';
import { describeSection } from './sections';

const rowStyles = css`
	border-bottom: 1px solid ${palette.neutral[86]};
`;

/**
 * The columns of each row, shared with the list's header row. Each row is its own grid,
 * so the columns have fixed widths for the rows and header to line up.
 */
export const articleColumnsStyles = css`
	display: grid;
	grid-template-columns: ${space[9]}px minmax(0, 1fr) 4.5rem 6.5rem 7.5rem;
	align-items: center;
	column-gap: ${space[3]}px;
`;

const summaryStyles = css`
	${articleColumnsStyles};
	padding: ${space[2]}px 0;

	&:hover {
		background-color: ${palette.neutral[97]};
	}
`;

const toggleStyles = (expanded: boolean) => css`
	display: flex;
	align-items: center;
	justify-content: center;
	width: ${space[9]}px;
	height: ${space[9]}px;
	padding: 0;
	border: none;
	background: none;
	cursor: pointer;

	svg {
		fill: ${palette.neutral[46]};
		transform: rotate(${expanded ? 180 : 0}deg);
		transition: transform 0.15s;
	}
`;

const titleStyles = css`
	${textSansBold15};
	text-decoration: none;

	&:hover {
		text-decoration: underline;
	}
`;

const pathStyles = css`
	${textSans12};
	color: ${palette.neutral[46]};
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const linksStyles = css`
	display: flex;
	align-items: center;
	gap: ${space[3]}px;
`;

const iconLinkStyles = (available: boolean) => css`
	display: flex;
	width: 14px;
	height: 14px;
	color: ${available ? palette.neutral[46] : palette.neutral[86]};

	svg {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}

	&:hover {
		color: ${available ? palette.neutral[7] : palette.neutral[86]};
	}
`;

/** An unavailable link is shown greyed out rather than left out, to keep the columns aligned. */
const IconLink = ({
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
	<div css={linksStyles}>
		<IconLink
			href={article.composerUrl}
			name="View in Composer"
			icon={<ComposerIcon />}
		/>
		<IconLink
			href={article.webUrl}
			name="View on Live site"
			icon={<LiveSiteIcon />}
		/>
		<IconLink
			href={article.ophanUrl}
			name="View in Ophan"
			icon={<OphanIcon />}
		/>
	</div>
);

const sectionStyles = (colour: string) => css`
	${textSansBold12};
	justify-self: start;
	white-space: nowrap;
	padding: 2px ${space[2]}px;
	border-radius: 2px;
	background-color: ${colour};
	color: ${palette.neutral[100]};
`;

const dateStyles = css`
	${textSans15};
	color: ${palette.neutral[20]};
`;

// Indented to line up with the article's title.
const panelStyles = css`
	padding: ${space[2]}px ${space[3]}px ${space[4]}px ${space[9] + space[3]}px;
`;

export const ArticleRow = ({ article }: { article: Article }) => {
	const [expanded, setExpanded] = useState(false);
	const panelId = useId();
	const section = describeSection(article.sectionId);

	return (
		<li css={rowStyles}>
			<div css={summaryStyles}>
				<button
					type="button"
					css={toggleStyles(expanded)}
					aria-expanded={expanded}
					aria-controls={panelId}
					aria-label={`Details for ${article.webTitle}`}
					onClick={() => setExpanded(!expanded)}
				>
					<SvgChevronDownSingle size="xsmall" />
				</button>
				<div>
					<Link
						href={article.webUrl}
						target="_blank"
						rel="noreferrer"
						cssOverrides={titleStyles}
					>
						{article.webTitle}
					</Link>
					<div css={pathStyles}>/{article.id}</div>
				</div>
				<ArticleLinks article={article} />
				<span css={sectionStyles(section.colour)}>{section.name}</span>
				<time css={dateStyles} dateTime={article.webPublicationDate}>
					{formatDate(article.webPublicationDate)}
				</time>
			</div>
			{expanded && (
				<div id={panelId} css={panelStyles}>
					<ProductList products={article.products} />
				</div>
			)}
		</li>
	);
};
