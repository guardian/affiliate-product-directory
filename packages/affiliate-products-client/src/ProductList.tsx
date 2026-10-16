import type { ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticColors, semanticSpacing } from '@guardian/stand';
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
import { formatDate } from './formatDate';
import { formatPrice } from './formatPrice';

// The columns are fixed so that a long URL is cut short rather than stretching its column.
const columns = { sm: '34% minmax(0, 1fr) 7rem 7rem 7.5rem' };

const weakText = { color: semanticColors.text.weak };

const urlStyles = css`
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

/**
 * The links grouped by their product name, each group where the name's first link is. A
 * product card's links all have its name, so a card with several retailers is one group.
 * Links without a name are each a group of their own.
 */
const groupByProductName = (products: ProductLink[]): ProductLink[][] => {
	const groups: ProductLink[][] = [];
	const groupsByName = new Map<string, ProductLink[]>();
	for (const link of products) {
		const named = link.productName && groupsByName.get(link.productName);
		if (named) {
			named.push(link);
			continue;
		}
		const group = [link];
		groups.push(group);
		if (link.productName) {
			groupsByName.set(link.productName, group);
		}
	}
	return groups;
};

// The rows of a group sit closer together, with a border only after the last. The
// attribute selector outweighs the cells' own padding.
const groupedRowStyles = ({
	first,
	last,
}: {
	first: boolean;
	last: boolean;
}) => css`
	${last ? '' : 'border-bottom: none;'}

	& > [role] {
		${first ? '' : `padding-top: ${semanticSpacing.stackXxs};`}
		${last ? '' : `padding-bottom: ${semanticSpacing.stackXxs};`}
	}
`;

/** A link's row. Only the first of a group's rows shows the product's name. */
const renderProductRow = (
	{
		url,
		label,
		productName,
		basePrice,
		currency,
		price,
		updatedAt,
		updatedBy,
	}: ProductLink,
	position: { first: boolean; last: boolean },
) => (
	<TableRow key={url} id={url} cssOverrides={groupedRowStyles(position)}>
		<TableCell>
			{position.first && productName && (
				<Typography element="div" variant="bodyBoldSm">
					{productName}
				</Typography>
			)}
			{label}
		</TableCell>
		<TableCell>
			<Link
				href={url}
				target="_blank"
				rel="noreferrer"
				cssOverrides={urlStyles}
			>
				{shortenUrl(url)}
			</Link>
		</TableCell>
		<TableCell>
			{basePrice ? (
				`${basePrice.currencySymbol}${formatPrice(basePrice.amount)}`
			) : (
				<Missing>No price found</Missing>
			)}
		</TableCell>
		<TableCell>
			{currency !== undefined && price !== undefined ? (
				formatCurrentPrice(currency, price)
			) : (
				<Missing>No price</Missing>
			)}
		</TableCell>
		<TableCell>
			{updatedAt !== undefined ? (
				<>
					{formatDate(updatedAt)}
					{updatedBy && (
						<Typography element="div" variant="bodySm" theme={weakText}>
							by {updatedBy}
						</Typography>
					)}
				</>
			) : (
				<Missing>Never</Missing>
			)}
		</TableCell>
	</TableRow>
);

/**
 * The product links found in an article, with the price each had when it was written and
 * its latest price in the directory. Links to the same product are listed together.
 */
export const ProductList = ({ products }: { products: ProductLink[] }) => {
	if (products.length === 0) {
		return (
			<Typography element="p" variant="bodySm" theme={weakText}>
				No product links in this article.
			</Typography>
		);
	}

	return (
		<Table aria-label="Product links" columns={columns} headerVisibleFrom="sm">
			<TableHeader>
				<TableColumnHeader isRowHeader>Product</TableColumnHeader>
				<TableColumnHeader>Link</TableColumnHeader>
				<TableColumnHeader>Base price</TableColumnHeader>
				<TableColumnHeader>Current price</TableColumnHeader>
				<TableColumnHeader>Updated</TableColumnHeader>
			</TableHeader>
			<TableBody>
				{groupByProductName(products).flatMap((group) =>
					group.map((link, index) =>
						renderProductRow(link, {
							first: index === 0,
							last: index === group.length - 1,
						}),
					),
				)}
			</TableBody>
		</Table>
	);
};
