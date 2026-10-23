import { useState } from 'react';

// The starred articles' CAPI IDs, kept in this browser only: one list for the stage's own
// data and one for PROD's, shown from another stage, as an article in one isn't the same
// article in the other.
const storageKey = (prod: boolean) =>
	`affiliate-products:starred:${prod ? 'prod' : 'own'}`;

// Storage can be blocked or cleared, so a failure leaves no articles starred.
const readStarred = (prod: boolean): string[] => {
	try {
		const stored: unknown = JSON.parse(
			localStorage.getItem(storageKey(prod)) ?? '[]',
		);
		return Array.isArray(stored)
			? stored.filter((id): id is string => typeof id === 'string')
			: [];
	} catch {
		return [];
	}
};

const writeStarred = (prod: boolean, ids: string[]) => {
	try {
		localStorage.setItem(storageKey(prod), JSON.stringify(ids));
	} catch {
		// The stars still work until the page is reloaded.
	}
};

/**
 * The articles starred in this browser for the data being shown, by CAPI ID in the order
 * they were starred.
 */
export const useStarred = (prod: boolean) => {
	const [lists, setLists] = useState(() => ({
		own: readStarred(false),
		prod: readStarred(true),
	}));
	const list = prod ? 'prod' : 'own';

	const toggleStar = (id: string) =>
		setLists((current) => {
			const ids = current[list];
			const next = ids.includes(id)
				? ids.filter((starredId) => starredId !== id)
				: [...ids, id];
			writeStarred(prod, next);
			return { ...current, [list]: next };
		});

	return { starred: lists[list], toggleStar };
};
