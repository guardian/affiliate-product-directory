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

interface User {
	email: string;
	firstName: string;
	lastName: string;
	avatarUrl?: string;
}

type AuthState =
	| { status: 'loading' }
	| { status: 'authenticated'; user: User; permissions: string[] }
	// The Panda cookie has expired since the page loaded.
	| { status: 'unauthenticated' }
	| { status: 'error' };

const fetchAuthState = async (): Promise<AuthState> => {
	const response = await fetch('/api/auth');
	if (response.status === 401) {
		return { status: 'unauthenticated' };
	}
	if (!response.ok) {
		return { status: 'error' };
	}
	const { user, permissions } = (await response.json()) as {
		user: User;
		permissions: string[];
	};
	return { status: 'authenticated', user, permissions };
};

const AuthDetails = ({ auth }: { auth: AuthState }) => {
	switch (auth.status) {
		case 'loading':
			return <p>Checking who you are…</p>;
		case 'unauthenticated':
			return (
				<p>
					Your login has expired. <a href="/">Reload the page</a> to log in
					again.
				</p>
			);
		case 'error':
			return <p>Could not reach the API.</p>;
		case 'authenticated':
			return (
				<>
					<p>
						Logged in as {auth.user.firstName} {auth.user.lastName} (
						{auth.user.email})
					</p>
					<p>Your permissions:</p>
					{auth.permissions.length > 0 ? (
						<ul>
							{auth.permissions.map((permission) => (
								<li key={permission}>{permission}</li>
							))}
						</ul>
					) : (
						<p>None</p>
					)}
				</>
			);
	}
};

export const App = () => {
	const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

	useEffect(() => {
		fetchAuthState()
			.then(setAuth)
			.catch(() => setAuth({ status: 'error' }));
	}, []);

	return (
		<>
			<header css={headerStyles}>
				<h1 css={headingStyles}>Affiliate Products</h1>
			</header>
			<main css={mainStyles}>
				<p>Coming soon.</p>
				<AuthDetails auth={auth} />
			</main>
		</>
	);
};
