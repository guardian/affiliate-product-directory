import { css } from '@emotion/react';
import {
	headlineBold34,
	palette,
	space,
	textSans17,
} from '@guardian/source/foundations';
import { useEffect, useState } from 'react';

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

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const authStatusText: Record<AuthStatus, string> = {
	loading: 'Checking…',
	authenticated: 'yes',
	unauthenticated: 'no',
	error: 'could not reach the API',
};

const fetchAuthStatus = async (): Promise<AuthStatus> => {
	const response = await fetch('/api/auth');
	if (!response.ok) {
		return 'error';
	}
	const { authenticated } = (await response.json()) as {
		authenticated: boolean;
	};
	return authenticated ? 'authenticated' : 'unauthenticated';
};

export const App = () => {
	const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

	useEffect(() => {
		fetchAuthStatus()
			.then(setAuthStatus)
			.catch(() => setAuthStatus('error'));
	}, []);

	return (
		<>
			<header css={headerStyles}>
				<h1 css={headingStyles}>Affiliate Products</h1>
			</header>
			<main css={mainStyles}>
				<p>Coming soon.</p>
				<p>Authenticated: {authStatusText[authStatus]}</p>
			</main>
		</>
	);
};
