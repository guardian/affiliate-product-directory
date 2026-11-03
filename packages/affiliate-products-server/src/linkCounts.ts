import type { LinkCounts } from '@common/tool-models';
import { decodeEntities } from './html';
import type { ArticleLinks, Block, BlockElement } from './types';

/** The hrefs of the links in some HTML, such as a text element's. */
const hrefs = (html: string) =>
	[...html.matchAll(/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)')/g)].map(
		([, doubleQuoted, singleQuoted]) =>
			decodeEntities(doubleQuoted ?? singleQuoted ?? ''),
	);

/** The links in a body element: in its text, or its product button or product card. */
const elementLinks = ({
	textTypeData,
	linkTypeData,
	productTypeData,
}: BlockElement) => [
	...hrefs(textTypeData?.html ?? ''),
	linkTypeData?.url ?? '',
	...(productTypeData?.productCtas ?? []).map((cta) => cta.url),
	...(productTypeData?.content ?? []).map(
		(element) => element.linkTypeData?.url ?? '',
	),
];

/** The links in an article's body, in order, repeats included. */
export const bodyLinks = (body: Block[]): string[] =>
	body
		.flatMap((block) => block.elements ?? [])
		.flatMap(elementLinks)
		.map((link) => link.trim())
		.filter((link) => link !== '');

/** Whether a URL is on a host or one of its subdomains. */
const isOnHost = (url: URL, host: string) =>
	url.hostname === host || url.hostname.endsWith(`.${host}`);

const isAmazon = (url: URL) =>
	isOnHost(url, 'amazon.co.uk') || isOnHost(url, 'amazon.com');

const isGuardian = (url: URL) =>
	isOnHost(url, 'theguardian.com') || isOnHost(url, 'dev-theguardian.com');

const isSkimresources = (url: URL) => isOnHost(url, 'skimresources.com');

/** The URL a Skimlinks link goes to, from its url parameter. */
const skimlinksTarget = (url: URL) => {
	try {
		return new URL(url.searchParams.get('url') ?? '');
	} catch {
		return undefined;
	}
};

/** A URL's host without www., as the domains in the Skimlinks file are. */
const domain = (url: URL) => url.hostname.replace(/^www\./, '');

/**
 * Whether frontend sends a link through Skimlinks when the article is rendered, as its
 * host, without www., is a Skimlinks merchant's, or it already does.
 */
const goesThroughSkimlinks = (url: URL, skimlinksDomains: Set<string>) =>
	isSkimresources(url) || skimlinksDomains.has(domain(url));

export type LinkKind = keyof LinkCounts;

/**
 * Sorts a link as the Affiliate Link Counter bookmarklet sorts the links on a rendered
 * page: an Amazon link if it goes to amazon.co.uk or amazon.com, even through Skimlinks;
 * otherwise a Skimlinks link if it goes through Skimlinks; and otherwise another external
 * link if it's to a web page off the Guardian's sites. Undefined for any other link.
 */
export const linkKind = (
	link: string,
	skimlinksDomains: Set<string>,
): LinkKind | undefined => {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		// A link without a host, such as /thefilter, is to the Guardian's own site.
		return undefined;
	}
	if (
		(url.protocol !== 'https:' && url.protocol !== 'http:') ||
		isGuardian(url)
	) {
		return undefined;
	}
	const target = isSkimresources(url) ? skimlinksTarget(url) : url;
	if (target && isAmazon(target)) {
		return 'amazon';
	}
	return goesThroughSkimlinks(url, skimlinksDomains) ? 'skimlinks' : 'other';
};

/** The external links, each sorted by kind, keeping their order and repeats. */
const sortLinks = (links: string[], skimlinksDomains: Set<string>) => {
	const sorted: Record<LinkKind, string[]> = {
		amazon: [],
		skimlinks: [],
		other: [],
	};
	for (const link of links) {
		const kind = linkKind(link, skimlinksDomains);
		if (kind) {
			sorted[kind].push(link);
		}
	}
	return sorted;
};

/** Counts the external links in an article's body, repeats included, by kind. */
export const countLinks = (
	links: string[],
	skimlinksDomains: Set<string>,
): LinkCounts => {
	const { amazon, skimlinks, other } = sortLinks(links, skimlinksDomains);
	return {
		amazon: amazon.length,
		skimlinks: skimlinks.length,
		other: other.length,
	};
};

/** The merchant URL a Skimlinks link goes to, without Skimlinks' sref parameter. */
const cleanLink = (skimlinksLink: string) => {
	const wrapped = /url=(.*)$/.exec(skimlinksLink)?.[1];
	let clean = skimlinksLink;
	if (wrapped !== undefined) {
		try {
			clean = decodeURIComponent(wrapped);
		} catch {
			clean = wrapped;
		}
	}
	clean = clean.replace(/(\?|&)sref=.*?(&|$)/, '$1');
	return clean.endsWith('&') ? clean.slice(0, -1) : clean;
};

const months = [
	'jan',
	'feb',
	'mar',
	'apr',
	'may',
	'jun',
	'jul',
	'aug',
	'sep',
	'oct',
	'nov',
	'dec',
];

/** The date in an article's URL, as in /2024/nov/26/, as 2024/11/26. */
const urlDate = (pageUrl: string) => {
	const [, year, month = '', day] =
		/\/(\d{4})\/([a-z]{3})\/(\d{2})/.exec(pageUrl) ?? [];
	const monthNumber = months.indexOf(month.toLowerCase()) + 1;
	return year && day && monthNumber > 0
		? `${year}/${String(monthNumber).padStart(2, '0')}/${day}`
		: 'N/A';
};

/** The last part of an article's URL, its "short title". */
export const shortTitle = (webUrl: string) =>
	new URL(webUrl).pathname.split('/').filter(Boolean).at(-1) ?? 'article';

const csvField = (value: string) => `"${value.replace(/"/g, '""')}"`;

const csvHeader = [
	'External Link',
	'Is Affiliate Link?',
	'Clean Product Link',
	'TLD Domain',
	'Page',
	'Full Page Title',
	'Short Title',
	'Page URL Date',
];

/** A link's row in the CSV, followed by the page's own columns. */
const csvRow = (
	link: string,
	pageColumns: string[],
	skimlinksDomains: Set<string>,
) => {
	const url = new URL(link);
	const clean = isSkimresources(url) ? cleanLink(link) : link;
	let cleanUrl = url;
	try {
		cleanUrl = new URL(clean);
	} catch {
		// A Skimlinks link whose url parameter isn't a URL keeps its own domain.
	}
	return [
		link,
		goesThroughSkimlinks(url, skimlinksDomains) ? 'Yes' : 'No',
		clean,
		domain(cleanUrl),
		...pageColumns,
	];
};

/**
 * The bookmarklet's CSV of an article's external links, in the columns it uses: each link
 * once, Amazon links first, then Skimlinks links, then the rest.
 */
export const linksCsv = (
	{ webUrl, webTitle, links }: ArticleLinks,
	skimlinksDomains: Set<string>,
): string => {
	const { amazon, skimlinks, other } = sortLinks(links, skimlinksDomains);
	const pageColumns = [webUrl, webTitle, shortTitle(webUrl), urlDate(webUrl)];
	const rows = [...new Set([...amazon, ...skimlinks, ...other])].map((link) =>
		csvRow(link, pageColumns, skimlinksDomains),
	);
	return [csvHeader, ...rows]
		.map((row) => row.map(csvField).join(','))
		.join('\n');
};
