import { createContext } from 'react';

/** Whether PROD's articles are shown, from another stage, so links to the API ask for them. */
export const ProdDataContext = createContext(false);

// PROD's tool only ever shows PROD's data. The same build is served to every stage, so
// PROD is told apart by its domain: CODE's is code.dev-gutools.co.uk.
export const isProd = window.location.hostname.endsWith('.gutools.co.uk');
