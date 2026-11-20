export const decodeEntities = (text: string) =>
	text
		.replace(/&nbsp;/g, ' ')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

/**
 * Removes HTML tags, repeating until none are left, the sanitising CodeQL recognises. An
 * unclosed angle bracket is left, so callers remove any angle brackets once they decode
 * entities.
 */
export const stripTags = (html: string) => {
	let previous: string;
	let text = html;
	do {
		previous = text;
		text = text.replace(/<[^>]+>/g, '');
	} while (text !== previous);
	return text;
};
