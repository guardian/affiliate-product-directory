import type { LinkCounts } from '@common/tool-models';

// theguardian.com's CDN refuses requests without a browser's User-Agent.
const browserUserAgent =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const pageTimeoutMs = 10_000;

// The sites articles are rendered on, by the host CAPI gives in their web URLs. CODE's
// articles are only served from its m. host.
const renderedHosts: Record<string, string> = {
	'www.theguardian.com': 'www.theguardian.com',
	'www.code.dev-theguardian.com': 'm.code.dev-theguardian.com',
	'm.code.dev-theguardian.com': 'm.code.dev-theguardian.com',
};

/**
 * The URL an article is rendered at, from the web URL CAPI gives it, or undefined if it
 * isn't on one of the Guardian's sites, so the tool only ever fetches those.
 */
export const renderedPageUrl = (webUrl: string): string | undefined => {
	try {
		const url = new URL(webUrl);
		const host = renderedHosts[url.hostname];
		return host ? `https://${host}${url.pathname}` : undefined;
	} catch {
		return undefined;
	}
};

const decodeEntities = (text: string) =>
	text
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&amp;/g, '&');

/** The external links on a page, in the order they appear, repeats included, by kind. */
interface ExternalLinks {
	amazon: string[];
	skimlinks: string[];
	other: string[];
}

/**
 * Sorts the links on a rendered page as the Affiliate Link Counter bookmarklet
 * (December 2024) does, so the numbers can be compared with ones it gave: every link,
 * repeats included, is an Amazon link if it goes to amazon.co.uk or amazon.com, even
 * through Skimlinks; otherwise a Skimlinks link if it goes through skimresources; and
 * otherwise another external link if it's to a web page on any other host than the
 * page's. Like the bookmarklet, this includes the Guardian's own links on other hosts, such
 * as jobs.theguardian.com in the footer.
 */
const externalLinks = (html: string, pageUrl: string): ExternalLinks => {
	// CODE's pages also link to www.theguardian.com, which the bookmarklet, run on PROD,
	// treats as the page's own site.
	const ownHosts = [new URL(pageUrl).hostname, 'www.theguardian.com'];
	const links: ExternalLinks = { amazon: [], skimlinks: [], other: [] };

	for (const [, doubleQuoted, singleQuoted] of html.matchAll(
		/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)')/g,
	)) {
		const rawHref = doubleQuoted ?? singleQuoted ?? '';
		let href: string;
		try {
			// As a browser gives a link's href, made absolute.
			href = new URL(decodeEntities(rawHref), pageUrl).href;
		} catch {
			continue;
		}

		if (href.includes('amazon.co.uk') || href.includes('amazon.com')) {
			links.amazon.push(href);
		} else if (href.includes('skimresources')) {
			links.skimlinks.push(href);
		} else if (
			href.startsWith('http') &&
			!ownHosts.some((host) => href.includes(host))
		) {
			links.other.push(href);
		}
	}
	return links;
};

/** Counts the links on a rendered page as the bookmarklet does. */
export const countLinks = (html: string, pageUrl: string): LinkCounts => {
	const { amazon, skimlinks, other } = externalLinks(html, pageUrl);
	return {
		amazon: amazon.length,
		skimlinks: skimlinks.length,
		other: other.length,
	};
};

// The bookmarklet leaves links to these hosts out of its CSV, though not its counts.
const csvExcludedHosts = [
	'jobs.theguardian.com',
	'manage.theguardian.com',
	'profile.theguardian.com',
	'support.theguardian.com',
	'recruiters.theguardian.com',
	'holidays.theguardian.com',
	'theguardian.newspapers.com',
	'patrons.theguardian.com',
	'licensing.theguardian.com',
	'policies.google.com',
	'workforus.theguardian.com',
	'uploads.guim.co.uk',
	'advertising.theguardian.com',
	'media.gutools.co.uk',
	'viewer.gutools.co.uk',
	'dashboard.ophan.co.uk',
	'composer.gutools.co.uk',
];

/** A URL's host without www., as the bookmarklet's "TLD Domain". */
const domain = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
};

/** The merchant URL a Skimlinks link goes to, without Skimlinks' sref parameter. */
const cleanLink = (url: string) => {
	const wrapped = /url=(.*)$/.exec(url)?.[1];
	let clean = url;
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

/** The text of a page's first top-level heading, its headline. */
const headline = (html: string) => {
	const h1 = /<h1\b[^>]*>(.*?)<\/h1>/s.exec(html)?.[1];
	return h1 === undefined
		? 'N/A'
		: decodeEntities(h1.replace(/<[^>]+>/g, ''))
				.replace(/\s+/g, ' ')
				.trim();
};

const csvField = (value: string) => `"${value.replace(/"/g, '""')}"`;

/**
 * The bookmarklet's CSV of a rendered page's external links: each once, Amazon links
 * first, then Skimlinks links, then the rest, leaving out its list of excluded hosts.
 */
export const linksCsv = (html: string, pageUrl: string): string => {
	const { amazon, skimlinks, other } = externalLinks(html, pageUrl);
	const page = [
		pageUrl,
		headline(html),
		pageUrl.split('/').pop()?.split('?')[0] ?? '',
		urlDate(pageUrl),
	];

	const rows = [...new Set([...amazon, ...skimlinks, ...other])]
		.filter((link) => !csvExcludedHosts.includes(domain(link)))
		.map((link) => {
			const clean = cleanLink(link);
			return [
				link,
				link.includes('skimresources') ? 'Yes' : 'No',
				clean,
				domain(clean || link),
				...page,
			];
		});

	return [
		[
			'External Link',
			'Is Affiliate Link?',
			'Clean Product Link',
			'TLD Domain',
			'Page',
			'Full Page Title',
			'Short Title',
			'Page URL Date',
		],
		...rows,
	]
		.map((row) => row.map(csvField).join(','))
		.join('\n');
};

/** An article as it's rendered on the site, and the URL it was finally read from. */
export interface RenderedPage {
	html: string;
	url: string;
}

/** Fetches an article as it's rendered on the site. */
export const fetchRenderedPage = async (
	pageUrl: string,
): Promise<RenderedPage> => {
	const response = await fetch(pageUrl, {
		headers: { 'User-Agent': browserUserAgent, Accept: 'text/html' },
		signal: AbortSignal.timeout(pageTimeoutMs),
	});
	if (!response.ok) {
		throw new Error(`${pageUrl} responded with status ${response.status}`);
	}
	return { html: await response.text(), url: response.url || pageUrl };
};
