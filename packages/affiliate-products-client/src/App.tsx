import { css } from '@emotion/react';
import {
	headlineBold34,
	palette,
	space,
	textSans17,
} from '@guardian/source/foundations';

const headerStyles = css`
	background-color: ${palette.brand[400]};
	color: ${palette.neutral[100]};
	padding: ${space[4]}px ${space[6]}px;
`;

const headingStyles = css`
	${headlineBold34};
	margin: 0;
`;

const mainStyles = css`
	${textSans17};
	padding: ${space[6]}px;
`;

export const App = () => (
	<>
		<header css={headerStyles}>
			<h1 css={headingStyles}>Affiliate Products</h1>
		</header>
		<main css={mainStyles}>
			<p>Coming soon.</p>
		</main>
	</>
);
