import { useState } from 'react';

const storageKey = 'affiliate-products:starred:own';

// Storage can be blocked or cleared, so a failure leaves no articles starred.
const readStarred = (): string[] => {
	try {
		const stored: unknown = JSON.parse(
			localStorage.getItem(storageKey) ?? '[]',
		);
		return Array.isArray(stored)
			? stored.filter((id): id is string => typeof id === 'string')
			: [];
	} catch {
		return [];
	}
};

const writeStarred = (ids: string[]) => {
	try {
		localStorage.setItem(storageKey, JSON.stringify(ids));
	} catch {
		// The stars still work until the page is reloaded.
	}
};

/**
 * The articles starred in this browser for the data being shown, by CAPI ID in the order
 * they were starred.
 */
export const useStarred = () => {
	const [list, setList] = useState(() => readStarred());

	const toggleStar = (id: string) =>
		setList((current) => {
			const next = current.includes(id)
				? current.filter((starredId) => starredId !== id)
				: [...current, id];
			writeStarred(next);
			return next;
		});

	return { starred: list, toggleStar };
};
