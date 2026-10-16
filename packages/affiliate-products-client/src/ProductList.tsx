import type { Product, ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
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
import { formatDate } from './formatDate';
import { formatPrice } from './formatPrice';

// The columns are fixed so that a long URL is cut short rather than stretching its column.
const columns = { sm: 'minmax(0, 1fr) 5.5rem 5.5rem 6.5rem 30%' };

const weakText = { color: semanticColors.text.weak };

// Like the POC, each product is a box with its name on top and a row for each retailer.
const productStyles = css`
	margin-bottom: ${semanticSpacing.stackXs};
	border: 1px solid ${semanticColors.border.weak};
	border-radius: ${semanticRadius.cornerSm};
	overflow: hidden;
`;

const productTopStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.bodyBoldSm)};
	display: flex;
	align-items: center;
	gap: ${semanticSpacing.stackXs};
	padding: ${semanticSpacing.stackXxs} ${semanticSpacing.stackXs};
	background-color: ${semanticColors.bg.raisedLevel1};
`;

const numberStyles = css`
	justify-content: flex-end;
	text-align: right;
	font-variant-numeric: tabular-nums;
`;

const ellipsisStyles = css`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

/** A URL as shown in the list: without its scheme or www, as those only take up room. */
const shortenUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

// The currencies the directory prices products in. Any other is shown by its code.
const currencySymbols: Record<string, string> = { GBP: '£', USD: '$' };

const formatCurrentPrice = (currency: string, price: number) =>
	`${currencySymbols[currency] ?? `${currency} `}${formatPrice(price)}`;

const Missing = ({ children }: { children: string }) => (
	<Typography variant="bodySm" theme={weakText}>
		{children}
	</Typography>
);

const renderLinkRow = ({
	url,
	label,
	retailer,
	basePrice,
	currency,
	price,
	updatedAt,
	updatedBy,
}: ProductLink) => (
	<TableRow key={url} id={url}>
		<TableCell>
			<div>
				<Link href={url} target="_blank" rel="noreferrer">
					{retailer ?? label}
				</Link>
				{/* The label is only worth showing when it says more than the retailer. */}
				{retailer && !label.trim().endsWith(retailer) && (
					<Typography element="div" variant="bodyXs" theme={weakText}>
						{label}
					</Typography>
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
		<TableCell cssOverrides={numberStyles}>
			{currency !== undefined && price !== undefined ? (
				formatCurrentPrice(currency, price)
			) : (
				<Missing>—</Missing>
			)}
		</TableCell>
		<TableCell>
			{updatedAt !== undefined ? (
				<div>
					{formatDate(updatedAt)}
					{updatedBy && (
						<Typography element="div" variant="bodyXs" theme={weakText}>
							by {updatedBy}
						</Typography>
					)}
				</div>
			) : (
				<Missing>N/A</Missing>
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
	</TableRow>
);

const ProductBox = ({ product: { name, links } }: { product: Product }) => (
	<div css={productStyles}>
		<div css={productTopStyles}>
			{name ?? (
				<Typography variant="bodyItalicSm" theme={weakText}>
					Unnamed product
				</Typography>
			)}
		</div>
		<Table
			aria-label={name ? `Retailers for ${name}` : 'Retailers'}
			columns={columns}
			headerVisibleFrom="sm"
		>
			<TableHeader>
				<TableColumnHeader isRowHeader>Retailer</TableColumnHeader>
				<TableColumnHeader cssOverrides={numberStyles}>Base</TableColumnHeader>
				<TableColumnHeader cssOverrides={numberStyles}>
					Current
				</TableColumnHeader>
				<TableColumnHeader>Updated</TableColumnHeader>
				<TableColumnHeader>Link</TableColumnHeader>
			</TableHeader>
			<TableBody>{links.map(renderLinkRow)}</TableBody>
		</Table>
	</div>
);

/**
 * The products found in an article, each with its links to the retailers that sell it,
 * the price each link had when it was written and its latest price in the directory.
 */
export const ProductList = ({ products }: { products: Product[] }) => {
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
				<ProductBox key={product.links[0]?.url} product={product} />
			))}
		</>
	);
};
