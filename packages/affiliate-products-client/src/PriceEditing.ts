import type { Region } from '@common/models';
import { createContext } from 'react';

export interface PriceEditing {
	/**
	 * Whether prices can be set by hand. Not when PROD is shown from another stage, as the
	 * server only writes to its own stage's pricing table.
	 */
	canEdit: boolean;
	/** Fetches the list again, to show a price that has just been set. */
	onPriceEdit: () => void;
	/**
	 * The region of a draft's prices, in Composer's embed. A price set there for a product
	 * the directory doesn't have yet adds it to the directory.
	 */
	draftRegion?: Region;
}

export const PriceEditingContext = createContext<PriceEditing>({
	canEdit: false,
	onPriceEdit: () => undefined,
});
