import type { ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	palette,
	space,
	textSans14,
	textSansBold14,
} from '@guardian/source/foundations';
import { Link } from '@guardian/source/react-components';
import { formatDate } from './formatDate';
import { formatPrice } from './formatPrice';

const emptyStyles = css`
	${textSans14};
	margin: 0;
	color: ${palette.neutral[46]};
`;

// The layout is fixed so that a long URL is cut short rather than stretching its column.
const tableStyles = css`
	${textSans14};
	width: 100%;
	table-layout: fixed;
	border-collapse: collapse;

	th,
	td {
		padding: ${space[1]}px ${space[3]}px ${space[1]}px 0;
		text-align: left;
		vertical-align: top;
	}

	th {
		${textSansBold14};
		color: ${palette.neutral[46]};
		border-bottom: 1px solid ${palette.neutral[86]};
	}
`;

const productColumnStyles = css`
	width: 34%;
`;

const priceColumnStyles = css`
	width: 7rem;
`;

const updatedColumnStyles = css`
	width: 7.5rem;
`;

const productNameStyles = css`
	${textSansBold14};
`;

const urlStyles = css`
	${textSans14};
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const noPriceStyles = css`
	color: ${palette.neutral[46]};
`;

const updatedByStyles = css`
	color: ${palette.neutral[46]};
`;

/** A URL as shown in the list: without its scheme or www, as those only take up room. */
const shortenUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

// The currencies the directory prices products in. Any other is shown by its code.
const currencySymbols: Record<string, string> = { GBP: '£', USD: '$' };

const formatCurrentPrice = (currency: string, price: number) =>
	`${currencySymbols[currency] ?? `${currency} `}${formatPrice(price)}`;

/**
 * The product links found in an article, with the price each had when it was written and
 * its latest price in the directory.
 */
export const ProductList = ({ products }: { products: ProductLink[] }) => {
	if (products.length === 0) {
		return <p css={emptyStyles}>No product links in this article.</p>;
	}

	return (
		<table css={tableStyles}>
			<thead>
				<tr>
					<th css={productColumnStyles}>Product</th>
					<th>Link</th>
					<th css={priceColumnStyles}>Base price</th>
					<th css={priceColumnStyles}>Current price</th>
					<th css={updatedColumnStyles}>Updated</th>
				</tr>
			</thead>
			<tbody>
				{products.map(
					({
						url,
						label,
						productName,
						basePrice,
						currency,
						price,
						updatedAt,
						updatedBy,
					}) => (
						<tr key={url}>
							<td>
								{productName && (
									<div css={productNameStyles}>{productName}</div>
								)}
								{label}
							</td>
							<td>
								<Link
									href={url}
									target="_blank"
									rel="noreferrer"
									title={url}
									cssOverrides={urlStyles}
								>
									{shortenUrl(url)}
								</Link>
							</td>
							<td>
								{basePrice ? (
									`${basePrice.currencySymbol}${formatPrice(basePrice.amount)}`
								) : (
									<span css={noPriceStyles}>No price found</span>
								)}
							</td>
							<td>
								{currency !== undefined && price !== undefined ? (
									formatCurrentPrice(currency, price)
								) : (
									<span css={noPriceStyles}>No price</span>
								)}
							</td>
							<td>
								{updatedAt !== undefined ? (
									<>
										{formatDate(updatedAt)}
										{updatedBy && (
											<div css={updatedByStyles}>by {updatedBy}</div>
										)}
									</>
								) : (
									<span css={noPriceStyles}>Never</span>
								)}
							</td>
						</tr>
					),
				)}
			</tbody>
		</table>
	);
};
