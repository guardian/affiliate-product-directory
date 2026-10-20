import { createContext } from 'react';

export interface PriceEditing {
	/**
	 * Whether prices can be set by hand. Not when PROD is shown from another stage, as the
	 * server only writes to its own stage's pricing table.
	 */
	canEdit: boolean;
	/** Fetches the list again, to show a price that has just been set. */
	onPriceEdit: () => void;
}

export const PriceEditingContext = createContext<PriceEditing>({
	canEdit: false,
	onPriceEdit: () => undefined,
});
