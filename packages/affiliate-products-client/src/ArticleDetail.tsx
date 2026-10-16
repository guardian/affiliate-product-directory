import type { Article, LinkCounts } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { Link } from '@guardian/stand/Link';
import { LinkButton } from '@guardian/stand/LinkButton';
import { Typography } from '@guardian/stand/Typography';
import {
	convertTypographyToEmotionStringStyle,
	from,
} from '@guardian/stand/utils';
import { useEffect, useState } from 'react';
import { fetchLinkCounts } from './api/linkCounts';
import { formatDate } from './formatDate';
import { ProductList } from './ProductList';
import { retailersUsed } from './productStats';
import { describeSection } from './sections';
import { accent } from './style';

const weakText = { color: semanticColors.text.weak };

// The POC's layout: the article's details and its links beside its products, then a bar
// of links to the article in other tools.
const columnsStyles = css`
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	background-color: ${semanticColors.bg.base};

	${from.lg} {
		grid-template-columns: minmax(16rem, 1fr) minmax(0, 3fr);
	}
`;

const columnStyles = css`
	min-width: 0;
	padding: ${semanticSpacing.stackMd};
	border-bottom: 1px solid ${semanticColors.border.weak};

	${from.lg} {
		border-bottom: none;
		border-right: 1px solid ${semanticColors.border.weak};

		&:last-of-type {
			border-right: none;
		}
	}
`;

// Each heading after the first in a column starts a new part of it.
const headingStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.headingXs)};
	margin: ${semanticSpacing.stackLg} 0 ${semanticSpacing.stackXs};
	text-transform: uppercase;
	color: ${semanticColors.text.weak};

	&:first-child {
		margin-top: 0;
	}
`;

const fieldsStyles = css`
	margin: 0;

	dt {
		${convertTypographyToEmotionStringStyle(semanticTypography.bodyXs)};
		margin: ${semanticSpacing.stackSm} 0 ${semanticSpacing.stackXxs};
		text-transform: uppercase;
		color: ${semanticColors.text.weak};
	}

	dt:first-of-type {
		margin-top: 0;
	}

	dd {
		${convertTypographyToEmotionStringStyle(semanticTypography.bodySm)};
		margin: 0;
		color: ${semanticColors.text.strong};
		overflow-wrap: anywhere;
	}
`;

const headlineStyles = css`
	&& {
		${convertTypographyToEmotionStringStyle(semanticTypography.bodyBoldLg)};
	}
`;

const pathStyles = css`
	padding: 1px ${semanticSpacing.stackXxs};
	border-radius: ${semanticRadius.cornerSm};
	background-color: ${semanticColors.bg.raisedLevel1};
	font-family: inherit;
`;

// Two by two, to fit the narrow column.
const statsStyles = css`
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1px;
	margin: 0;
	border: 1px solid ${semanticColors.border.weak};
	border-radius: ${semanticRadius.cornerSm};
	overflow: hidden;
	background-color: ${semanticColors.border.weak};
`;

const statStyles = css`
	padding: ${semanticSpacing.stackXs} ${semanticSpacing.stackSm};
	background-color: ${semanticColors.bg.base};
`;

const statLabelStyles = css`
	margin-top: ${semanticSpacing.stackXxs};
	text-transform: uppercase;
`;

// Like the POC, the actions sit on a bar tinted with its accent.
const actionBarStyles = css`
	display: flex;
	flex-wrap: wrap;
	gap: ${semanticSpacing.stackXs};
	padding: ${semanticSpacing.stackSm} ${semanticSpacing.stackMd};
	border-top: 1px solid ${accent.tintBorder};
	background-color: ${accent.tint};
`;

const Stat = ({ value, label }: { value: string; label: string }) => (
	<div css={statStyles}>
		<Typography element="div" variant="bodyBoldMd">
			{value}
		</Typography>
		<Typography
			element="div"
			variant="bodyXs"
			theme={weakText}
			cssOverrides={statLabelStyles}
		>
			{label}
		</Typography>
	</div>
);

/** A link to the article in another tool, disabled if there isn't one. */
const ActionLink = ({
	href,
	primary = false,
	children,
}: {
	href?: string;
	primary?: boolean;
	children: string;
}) => (
	<LinkButton
		href={href}
		isDisabled={!href}
		target="_blank"
		rel="noreferrer"
		variant={primary ? 'primary' : 'secondary'}
		size="sm"
		icon="open_in_new"
	>
		{children}
	</LinkButton>
);

type LinkCountsState =
	| { status: 'loading' }
	| { status: 'loaded'; counts: LinkCounts }
	| { status: 'error' };

const formatShare = (part: number, total: number) =>
	total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;

/**
 * The links on the article as it's rendered, counted as the Affiliate Link Counter
 * bookmarklet counts them, with the share of them that are affiliate links.
 */
const LinkCountStats = ({ state }: { state: LinkCountsState }) => {
	if (state.status === 'error') {
		return (
			<Typography element="p" variant="bodySm" theme={weakText}>
				The article’s page couldn’t be read.
			</Typography>
		);
	}
	const counts = state.status === 'loaded' ? state.counts : undefined;
	const show = (value: (c: LinkCounts) => string) =>
		counts ? value(counts) : '…';
	return (
		<div css={statsStyles}>
			<Stat value={show((c) => String(c.amazon))} label="Amazon link count" />
			<Stat
				value={show((c) => String(c.skimlinks))}
				label="Skimlinks link count"
			/>
			<Stat
				value={show((c) => String(c.other))}
				label="Other external link count"
			/>
			<Stat
				value={show((c) =>
					formatShare(c.amazon + c.skimlinks, c.amazon + c.skimlinks + c.other),
				)}
				label="Affiliate share"
			/>
		</div>
	);
};

/** An open article's details and links, its products with their retailer links, and actions. */
export const ArticleDetail = ({
	id,
	article,
}: {
	id: string;
	article: Article;
}) => {
	const retailers = retailersUsed(article);
	// A draft isn't on the site, so has no page to read its links from.
	const { webUrl } = article;
	const csvUrl =
		webUrl &&
		`/api/link-counts.csv?${new URLSearchParams({ url: webUrl }).toString()}`;
	const [linkCounts, setLinkCounts] = useState<LinkCountsState>({
		status: 'loading',
	});

	useEffect(() => {
		if (!webUrl) {
			return;
		}
		const controller = new AbortController();
		fetchLinkCounts(webUrl, controller.signal)
			.then((counts) =>
				setLinkCounts(
					counts ? { status: 'loaded', counts } : { status: 'error' },
				),
			)
			.catch(() => {
				if (!controller.signal.aborted) {
					setLinkCounts({ status: 'error' });
				}
			});
		return () => controller.abort();
	}, [webUrl]);

	return (
		<div id={id}>
			<div css={columnsStyles}>
				<section css={columnStyles}>
					<h4 css={headingStyles}>Links</h4>
					{webUrl ? (
						<LinkCountStats state={linkCounts} />
					) : (
						<Typography element="p" variant="bodySm" theme={weakText}>
							The links are counted once the article is published.
						</Typography>
					)}
					<h4 css={headingStyles}>Article</h4>
					<dl css={fieldsStyles}>
						<dt>Headline</dt>
						<dd css={headlineStyles}>{article.webTitle}</dd>
						<dt>Byline</dt>
						<dd>{article.byline ?? '—'}</dd>
						<dt>Section</dt>
						<dd>
							{describeSection(article.sectionId).name} ({article.sectionId})
						</dd>
						<dt>Path</dt>
						<dd>
							{webUrl ? (
								<Link
									href={webUrl}
									target="_blank"
									rel="noreferrer"
									typography="bodySm"
								>
									<code css={pathStyles}>/{article.id}</code>
								</Link>
							) : (
								<code css={pathStyles}>/{article.id}</code>
							)}
						</dd>
						<dt>Published</dt>
						<dd>
							{article.webPublicationDate
								? formatDate(article.webPublicationDate)
								: 'Not yet published'}
						</dd>
						{article.lastModified && (
							<>
								<dt>Last edited</dt>
								<dd>{formatDate(article.lastModified)}</dd>
							</>
						)}
						<dt>Retailers used</dt>
						<dd>{retailers.join(', ') || '—'}</dd>
					</dl>
				</section>

				<section css={columnStyles}>
					<h4 css={headingStyles}>Products ({article.products.length})</h4>
					<ProductList products={article.products} />
				</section>
			</div>

			<div css={actionBarStyles}>
				<ActionLink href={article.composerUrl} primary={true}>
					Open in Composer
				</ActionLink>
				<ActionLink href={webUrl}>Live site</ActionLink>
				<ActionLink href={article.ophanUrl}>Ophan</ActionLink>
				{/* The bookmarklet's CSV of the article's external links, read from its page again. */}
				<LinkButton
					href={csvUrl}
					isDisabled={!csvUrl}
					download
					variant="secondary"
					size="sm"
					icon="download"
				>
					Download CSV
				</LinkButton>
			</div>
		</div>
	);
};
