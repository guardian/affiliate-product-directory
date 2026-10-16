// Shared by the affiliate tool's server and client, so it should only use the platform.

// A CAPI ID: a section, then the rest of the path, such as thefilter/2026/oct/16/best-kettles.
const capiIdPattern = /^[a-z0-9-]+(\/[a-z0-9._-]+)+$/i;

// Where an article's web URL can be: PROD's site or one of the dev stages' sites.
const siteHostPattern =
	/^(www\.|m\.)?(theguardian\.com|([a-z0-9-]+\.)*dev-theguardian\.com)$/i;

/**
 * The CAPI ID of the article at a pasted URL or path, or undefined if it isn't one.
 * Takes a site URL from any stage (with or without its query string), or a path with
 * or without its leading slash.
 */
export const articlePath = (input: string): string | undefined => {
	const trimmed = input.trim();
	let path = trimmed;
	if (/^https?:\/\//i.test(trimmed)) {
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			return undefined;
		}
		if (!siteHostPattern.test(url.hostname)) {
			return undefined;
		}
		path = url.pathname;
	} else {
		path = trimmed.split(/[?#]/)[0] ?? '';
	}
	path = path.replace(/^\/+|\/+$/g, '');
	return capiIdPattern.test(path) ? path : undefined;
};
