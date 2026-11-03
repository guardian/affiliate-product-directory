import { createContext } from 'react';

export interface Starred {
	isStarred: (id: string) => boolean;
	toggleStar: (id: string) => void;
}

export const StarredContext = createContext<Starred>({
	isStarred: () => false,
	toggleStar: () => undefined,
});
