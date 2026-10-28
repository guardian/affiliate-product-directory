import type { Product, ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { Icon } from '@guardian/stand/Icon';
import { IconButton } from '@guardian/stand/IconButton';
import { Link } from '@guardian/stand/Link';
import {
	Table,
	TableBody,
	TableCell,
	TableColumnHeader,
	TableHeader,
	TableRow,
} from '@guardian/stand/Table';
import { Typography } from '@guardian/stand/Typography';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import { useContext, useState } from 'react';
import { ButtonPreview } from './ButtonPreview';
import { type Currency, currencySymbol } from './currency';
import { formatDate, formatDateTime } from './formatDate';
import { formatPrice } from './formatPrice';
import { PriceEditingContext } from './PriceEditing';
import { PriceOverrideModal } from './PriceOverrideModal';
import { hasPriceGap, priceDifference } from './productStats';
import { priceGapAccent } from './style';

// The columns are fixed so that a long URL is cut short rather than stretching its column.
const columns = { sm: 'minmax(0, 1fr) 5.5rem 7rem 6.5rem 30%' };
// Composer's narrow panel has room for just the prices, so the rest goes under the retailer.
const compactColumns = { sm: 'minmax(0, 1fr) 5.5rem 5.5rem' };

const weakText = { color: semanticColors.text.weak };

// Each product is its name as a heading, over Stand's table with a row for each retailer.
// The space between them is what tells one product from the next.
const productStyles = css`
	margin-bottom: ${semanticSpacing.stackMd};
`;

const productNameStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.bodyBoldSm)};
	margin: 0 0 ${semanticSpacing.stackXxs};
`;

const numberStyles = css`
	justify-content: flex-end;
	text-align: right;
	font-variant-numeric: tabular-nums;
	/* A price wraps mid-number in a narrow column, e.g. "£16.5" over "0". */
	white-space: nowrap;
`;

// Lets the URL under the retailer be cut short rather than widen the column.
const compactRetailerStyles = css`
	min-width: 0;
`;

const ellipsisStyles = css`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

/** A URL as shown in the list: without its scheme or www, as those only take up room. */
const shortenUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

const formatCurrentPrice = (currency: string, price: number) =>
	`${currencySymbol(currency)}${formatPrice(price)}`;

const gapCellStyles = css`
	${numberStyles};
	background-color: ${priceGapAccent.tint};
`;

const gapPriceStyles = css`
	display: inline-flex;
	align-items: center;
	gap: ${semanticSpacing.stackXxs};
`;

const gapTheme = { color: priceGapAccent.text };

/** How far a price is from the article's, such as "31% higher". */
const describeDifference = (difference: number) =>
	`${Math.round(Math.abs(difference) * 100)}% ${difference > 0 ? 'higher' : 'lower'}`;

const Missing = ({ children }: { children: string }) => (
	<Typography variant="bodySm" theme={weakText}>
		{children}
	</Typography>
);

const currentPriceStyles = css`
	display: inline-flex;
	align-items: center;
	white-space: nowrap;
	gap: ${semanticSpacing.stackXxs};
`;

// Stand's outline still shows when the edit button has keyboard focus.
const plainIconTheme = {
	tertiary: {
		shared: {
			color: semanticColors.text.weak,
			border: 'none',
			hover: { border: 'none', backgroundColor: 'transparent' },
			active: { border: 'none', backgroundColor: 'transparent' },
			disabled: { border: 'none', backgroundColor: 'transparent' },
		},
	},
};

const plainIconStyles = css`
	&[data-hovered],
	&[data-pressed] {
		color: ${semanticColors.text.strong};
	}
`;

/** A link's price in the directory, with a button to set it by hand where that's allowed. */
const CurrentPrice = ({
	link,
	productName,
	articleCurrency,
}: {
	link: ProductLink;
	productName?: string;
	articleCurrency?: Currency;
}) => {
	const { canEdit } = useContext(PriceEditingContext);
	const [editing, setEditing] = useState(false);
	const { currency, price, updatedBy } = link;
	const shown =
		currency !== undefined && price !== undefined ? (
			formatCurrentPrice(currency, price)
		) : (
			<Missing>—</Missing>
		);

	if (!canEdit) {
		return shown;
	}

	return (
		<span css={currentPriceStyles}>
			{shown}
			<IconButton
				symbol="edit"
				variant="tertiary"
				size="xs"
				theme={plainIconTheme}
				cssOverrides={plainIconStyles}
				ariaLabel={`${updatedBy === 'manualOverride' ? 'Change' : 'Set'} the price at ${link.retailer ?? link.url} by hand`}
				onPress={() => setEditing(true)}
			/>
			{editing && (
				<PriceOverrideModal
					link={link}
					productName={productName}
					articleCurrency={articleCurrency}
					isOpen={editing}
					onOpenChange={setEditing}
				/>
			)}
		</span>
	);
};

/** When a link's price was set and by what, or why it has none. */
const updatedText = ({
	updatedAt,
	updatedBy,
	expiresAt,
	notInDirectory,
}: ProductLink) => {
	if (updatedAt === undefined) {
		return notInDirectory ? 'Not in the directory yet' : 'Not priced yet';
	}
	if (updatedBy === 'manualOverride') {
		return `Set manually ${formatDate(updatedAt)}${expiresAt !== undefined ? `, until ${formatDate(expiresAt)}` : ''}`;
	}
	return `Updated ${formatDate(updatedAt)}${updatedBy ? ` by ${updatedBy}` : ''}`;
};

const renderLinkRow = (
	link: ProductLink,
	productName: string | undefined,
	articleCurrency: Currency | undefined,
	compact: boolean,
) => {
	const { url, label, retailer, basePrice } = link;
	const difference = priceDifference(link);
	const gap = hasPriceGap(link);
	return (
		<TableRow key={url} id={url}>
			<TableCell>
				<div css={compact && compactRetailerStyles}>
					<ButtonPreview link={link}>
						<Link
							href={url}
							target="_blank"
							rel="noreferrer"
							typography="bodySm"
						>
							{retailer ?? label}
						</Link>
					</ButtonPreview>
					{/* The label is only worth showing when it says more than the retailer. */}
					{retailer && !label.trim().endsWith(retailer) && (
						<Typography element="div" variant="bodyXs" theme={weakText}>
							{label}
						</Typography>
					)}
					{compact && (
						<>
							<Typography
								element="div"
								variant="bodyXs"
								theme={weakText}
								cssOverrides={ellipsisStyles}
							>
								{shortenUrl(url)}
							</Typography>
							<Typography element="div" variant="bodyXs" theme={weakText}>
								<span
									title={
										link.updatedAt !== undefined
											? formatDateTime(link.updatedAt)
											: undefined
									}
								>
									{updatedText(link)}
								</span>
							</Typography>
						</>
					)}
				</div>
			</TableCell>
			<TableCell cssOverrides={numberStyles}>
				{basePrice ? (
					`${basePrice.currencySymbol}${formatPrice(basePrice.amount)}`
				) : (
					<Missing>—</Missing>
				)}
			</TableCell>
			<TableCell cssOverrides={gap ? gapCellStyles : numberStyles}>
				{gap && difference !== undefined ? (
					<div>
						<span css={gapPriceStyles}>
							<Icon
								symbol="warning"
								size="xs"
								fill={priceGapAccent.icon}
								alt="Far from the article’s price"
							/>
							<CurrentPrice
								link={link}
								productName={productName}
								articleCurrency={articleCurrency}
							/>
						</span>
						<Typography element="div" variant="bodyBoldXs" theme={gapTheme}>
							{describeDifference(difference)}
						</Typography>
					</div>
				) : (
					<CurrentPrice
						link={link}
						productName={productName}
						articleCurrency={articleCurrency}
					/>
				)}
			</TableCell>
			{!compact && renderDetailCells(link)}
		</TableRow>
	);
};

/** The full list's Updated and Link columns. */
const renderDetailCells = (link: ProductLink) => {
	const { url, updatedAt, updatedBy } = link;
	return (
		<>
			<TableCell>
				{updatedAt !== undefined ? (
					<div>
						<time
							dateTime={new Date(updatedAt).toISOString()}
							title={formatDateTime(updatedAt)}
						>
							{formatDate(updatedAt)}
						</time>
						{updatedBy === 'manualOverride' ? (
							<Typography element="div" variant="bodyXs" theme={weakText}>
								set manually
								{link.expiresAt !== undefined &&
									`, until ${formatDate(link.expiresAt)}`}
							</Typography>
						) : (
							updatedBy && (
								<Typography element="div" variant="bodyXs" theme={weakText}>
									by {updatedBy}
								</Typography>
							)
						)}
					</div>
				) : (
					<Missing>
						{link.notInDirectory ? 'Not in the directory yet' : 'N/A'}
					</Missing>
				)}
			</TableCell>
			<TableCell>
				<Link
					href={url}
					target="_blank"
					rel="noreferrer"
					typography="bodySm"
					cssOverrides={ellipsisStyles}
				>
					{shortenUrl(url)}
				</Link>
			</TableCell>
		</>
	);
};

// Under the panel's PRODUCTS heading, which is an h4.
const ProductTable = ({
	product: { name, links },
	articleCurrency,
	compact,
}: {
	product: Product;
	articleCurrency?: Currency;
	compact: boolean;
}) => (
	<div css={productStyles}>
		<h5 css={productNameStyles}>
			{name ?? (
				<Typography variant="bodyItalicSm" theme={weakText}>
					Unnamed product
				</Typography>
			)}
		</h5>
		<Table
			aria-label={name ? `Retailers for ${name}` : 'Retailers'}
			columns={compact ? compactColumns : columns}
			headerVisibleFrom="sm"
		>
			<TableHeader>
				<TableColumnHeader isRowHeader>Retailer</TableColumnHeader>
				<TableColumnHeader cssOverrides={numberStyles}>Base</TableColumnHeader>
				<TableColumnHeader cssOverrides={numberStyles}>
					Current
				</TableColumnHeader>
				{!compact && <TableColumnHeader>Updated</TableColumnHeader>}
				{!compact && <TableColumnHeader>Link</TableColumnHeader>}
			</TableHeader>
			<TableBody>
				{links.map((link) =>
					renderLinkRow(link, name, articleCurrency, compact),
				)}
			</TableBody>
		</Table>
	</div>
);

/**
 * The products found in an article, each with its links to the retailers that sell it,
 * the price each link had when it was written and its latest price in the directory.
 */
export const ProductList = ({
	products,
	articleCurrency,
	compact = false,
}: {
	products: Product[];
	/** The currency the article's section is priced in, to warn when a price is set in another. */
	articleCurrency?: Currency;
	/** For a narrow column, such as Composer's panel: just the prices, with the rest under the retailer. */
	compact?: boolean;
}) => {
	if (products.length === 0) {
		return (
			<Typography element="p" variant="bodySm" theme={weakText}>
				No product links in this article.
			</Typography>
		);
	}

	return (
		<>
			{products.map((product) => (
				// A URL is only in one product, so the first identifies it.
				<ProductTable
					key={product.links[0]?.url}
					product={product}
					articleCurrency={articleCurrency}
					compact={compact}
				/>
			))}
		</>
	);
};
