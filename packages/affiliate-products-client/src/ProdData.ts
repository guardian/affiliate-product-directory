import { createContext } from 'react';

/** Whether PROD's articles are shown, from another stage, so links to the API ask for them. */
export const ProdDataContext = createContext(false);

// PROD's tool only ever shows PROD's data. The same build is served to every stage, so
// PROD is told apart by its domain: CODE's is code.dev-gutools.co.uk.
export const isProd = window.location.hostname.endsWith('.gutools.co.uk');

// Run locally, the tool is served at affiliate-products.local.dev-gutools.co.uk, or by Vite
// on localhost.
const isLocal =
	window.location.hostname.endsWith('.local.dev-gutools.co.uk') ||
	window.location.hostname === 'localhost';

export type Stage = 'PROD' | 'CODE' | 'DEV';

const currentStage = (): Stage => {
	if (isProd) {
		return 'PROD';
	}
	if (isLocal) {
		return 'DEV';
	}
	return 'CODE';
};

/** The stage the tool is running in, told apart by its domain. */
export const stage = currentStage();
