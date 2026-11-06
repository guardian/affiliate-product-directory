import { articlesPageSize } from '@common/tool-models';
import type { ArticlesPage } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticSpacing } from '@guardian/stand';
import { Pagination as StandPagination } from '@guardian/stand/Pagination';
import { headlineInset } from './ArticleRow';

// Lined up with the headlines above, and clear of the last row.
const paginationStyles = css`
	padding: ${semanticSpacing.stackLg} ${semanticSpacing.stackMd};
	padding-left: ${headlineInset};
`;

export const Pagination = ({
	page,
	onChange,
}: {
	page: ArticlesPage;
	onChange: (page: number) => void;
}) => (
	<StandPagination
		currentPage={page.currentPage}
		totalItems={page.total}
		pageSize={articlesPageSize}
		onPageChange={onChange}
		renderSummary={({ startItem, endItem, totalItems }) =>
			`Articles ${startItem}–${endItem} of ${totalItems}`
		}
		labels={{ nav: 'Pages' }}
		cssOverrides={paginationStyles}
	/>
);
