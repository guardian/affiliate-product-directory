import { css } from '@emotion/react';
import {
	fontTitle,
	sidebarWidth,
	toolPalette,
	topToolbarHeight,
} from './style';

const toolbarStyles = css`
	position: sticky;
	top: 0;
	z-index: 2;
	display: flex;
	height: ${topToolbarHeight}px;
	background-color: ${toolPalette.bluegrey};
	border-bottom: 1px solid ${toolPalette.grey400};
`;

const titleStyles = css`
	display: flex;
	flex: 0 0 ${sidebarWidth}px;
	background-color: ${toolPalette.grey350};
	border-right: 1px solid ${toolPalette.grey400};
	font-family: ${fontTitle};
	line-height: ${topToolbarHeight}px;
	text-align: center;
`;

const titleLetterStyles = css`
	flex: 0 0 ${topToolbarHeight}px;
	border-right: 1px solid ${toolPalette.grey300};
	font-size: 20px;
`;

const titleTextStyles = css`
	flex: 1 1 auto;
	margin: 0;
	font-size: 18px;
	font-weight: 400;
`;

const userStyles = css`
	display: flex;
	align-items: center;
	margin-left: auto;
	padding: 0 15px;
	border-left: 1px solid ${toolPalette.grey400};
	font-size: 13px;
`;

export const TopToolbar = ({ userName }: { userName?: string }) => (
	<header css={toolbarStyles}>
		<div css={titleStyles}>
			<div css={titleLetterStyles} aria-hidden="true">
				A
			</div>
			<h1 css={titleTextStyles}>Affiliate</h1>
		</div>
		{userName && <div css={userStyles}>{userName}</div>}
	</header>
);
