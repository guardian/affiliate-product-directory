// Types only the client uses. The shapes it shares with the server are in @common/tool-models.

import type { ArticlesPage, ArticleStatus, Section } from '@common/tool-models';

export type ArticlesState =
	| { status: 'loading' }
	| { status: 'loaded'; page: ArticlesPage }
	// The Panda cookie has expired since the page loaded.
	| { status: 'unauthenticated' }
	| { status: 'error' };

/** Which part of the article list is being viewed, as held in the page's URL. */
export interface ListParams {
	page: number;
	/** Undefined when articles from every section are shown. */
	section: Section | undefined;
	/** Just drafts or just live articles. Undefined when both are shown, drafts first. */
	status: ArticleStatus | undefined;
	/** Whether just the articles with live pricing are shown. */
	livePricing: boolean;
	/** Whether PROD's articles and prices are shown, rather than the stage's own. */
	prod: boolean;
	/** An article's URL or path, to show just that article. Undefined to show the list. */
	path: string | undefined;
}
