import { createContext } from 'react';

/** Whether PROD's articles are shown, from another stage, so links to the API ask for them. */
export const ProdDataContext = createContext(false);
