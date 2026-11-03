import type { Article, LinkCounts } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { AlertBanner } from '@guardian/stand/AlertBanner';
import { Link } from '@guardian/stand/Link';
import { LinkButton } from '@guardian/stand/LinkButton';
import { Typography } from '@guardian/stand/Typography';
import {
	convertTypographyToEmotionStringStyle,
	from,
} from '@guardian/stand/utils';
import { useContext } from 'react';
import { formatDate } from './formatDate';
import { SkimlinksIcon } from './icons';
import { ProdDataContext } from './ProdData';
import { ProductList } from './ProductList';
import { retailersUsed } from './productStats';
import { describeSection } from './sections';
import { skimlinksUrl } from './skimlinksUrl';
import { accent, wrappingBannerTheme } from './style';

const weakText = { color: semanticColors.text.weak };

// The article's details and its links beside its products, then a bar
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

// The banners about the article's prices, spaced apart.
const bannersStyles = css`
	display: grid;
	gap: ${semanticSpacing.stackXs};
`;

const skimlinksMarkStyles = css`
	display: inline-flex;
	width: 12px;
	height: 12px;
	margin-left: ${semanticSpacing.stackXxs};
	vertical-align: -1px;
	color: ${semanticColors.text.weak};

	svg {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}
`;

const retailersStyles = css`
	margin: 0;
	padding-left: ${semanticSpacing.stackMd};
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

const formatShare = (part: number, total: number) =>
	total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;

/**
 * The external links in the article's body, counted as the Affiliate Link Counter
 * bookmarklet counts them, with the share of them that are affiliate links.
 */
const LinkCountStats = ({ counts }: { counts: LinkCounts | undefined }) => {
	if (!counts) {
		return (
			<Typography element="p" variant="bodySm" theme={weakText}>
				The links couldn’t be counted.
			</Typography>
		);
	}
	const { amazon, skimlinks, other } = counts;
	return (
		<div css={statsStyles}>
			<Stat value={String(amazon)} label="Amazon link count" />
			<Stat value={String(skimlinks)} label="Skimlinks link count" />
			<Stat value={String(other)} label="Other external link count" />
			<Stat
				value={formatShare(amazon + skimlinks, amazon + skimlinks + other)}
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
	const prod = useContext(ProdDataContext);
	const { webUrl } = article;
	// A draft isn't in CAPI yet, so its links can only be counted once it's published.
	const csvUrl =
		webUrl &&
		`/api/links.csv?${new URLSearchParams({
			path: article.id,
			...(prod && { prod: 'true' }),
		}).toString()}`;

	return (
		<div id={id}>
			<div css={columnsStyles}>
				<section css={columnStyles}>
					{(article.livePricing || article.products.length > 0) && (
						<div css={bannersStyles}>
							{article.livePricing && (
								<AlertBanner
									level="success"
									showIcon={true}
									icon="update"
									theme={wrappingBannerTheme}
								>
									Live pricing is enabled.
								</AlertBanner>
							)}
							{!article.livePricing && article.products.length > 0 && (
								<AlertBanner
									level="warning"
									showIcon={true}
									icon="update_disabled"
									theme={wrappingBannerTheme}
								>
									<span>
										Live pricing is disabled. You can enable live pricing within{' '}
										{article.composerUrl ? (
											<Link
												href={article.composerUrl}
												target="_blank"
												rel="noreferrer"
												typography="bodySm"
											>
												Composer
											</Link>
										) : (
											'Composer'
										)}
										.
									</span>
								</AlertBanner>
							)}
						</div>
					)}
					<h4 css={headingStyles}>Links</h4>
					{webUrl ? (
						<LinkCountStats counts={article.linkCounts} />
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
								<dt>Last modified</dt>
								<dd>{formatDate(article.lastModified)}</dd>
							</>
						)}
						<dt>Retailers used</dt>
						<dd>
							{retailers.length > 0 ? (
								<ul css={retailersStyles}>
									{retailers.map(({ retailer, links, skimlinks }) => (
										<li key={retailer}>
											{retailer} ({links})
											{skimlinks && (
												<span
													css={skimlinksMarkStyles}
													title="Links go through Skimlinks"
													aria-label="Links go through Skimlinks"
													role="img"
												>
													<SkimlinksIcon />
												</span>
											)}
										</li>
									))}
								</ul>
							) : (
								'—'
							)}
						</dd>
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
				<ActionLink
					href={webUrl && skimlinksUrl(webUrl, article.webPublicationDate)}
				>
					Skimlinks
				</ActionLink>
				{/* The bookmarklet's CSV of the external links in the article's body. */}
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
