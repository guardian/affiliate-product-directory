import type { ArticlesPage } from '@common/tool-models';
import { css } from '@emotion/react';
import { space, textSans15 } from '@guardian/source/foundations';
import {
	Button,
	SvgChevronLeftSingle,
	SvgChevronRightSingle,
} from '@guardian/source/react-components';

const paginationStyles = css`
	${textSans15};
	display: flex;
	align-items: center;
	gap: ${space[3]}px;
	margin: ${space[4]}px 0;
`;

export const Pagination = ({
	page,
	onChange,
}: {
	page: ArticlesPage;
	onChange: (page: number) => void;
}) => (
	<nav css={paginationStyles} aria-label="Pages">
		<Button
			size="xsmall"
			priority="tertiary"
			icon={<SvgChevronLeftSingle />}
			iconSide="left"
			disabled={page.currentPage <= 1}
			onClick={() => onChange(page.currentPage - 1)}
		>
			Previous
		</Button>
		<span>
			Page {page.currentPage} of {page.pages} · {page.total} articles
		</span>
		<Button
			size="xsmall"
			priority="tertiary"
			icon={<SvgChevronRightSingle />}
			iconSide="right"
			disabled={page.currentPage >= page.pages}
			onClick={() => onChange(page.currentPage + 1)}
		>
			Next
		</Button>
	</nav>
);
