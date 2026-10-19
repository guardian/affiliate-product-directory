import { articlesPageSize } from '@common/tool-models';
import type { ArticlesPage } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticSpacing } from '@guardian/stand';
import { Pagination as StandPagination } from '@guardian/stand/Pagination';

const paginationStyles = css`
	margin: ${semanticSpacing.stackMd} 0;
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
