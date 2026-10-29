import { articlePath } from './articlePath';

describe('articlePath', () => {
	const id = 'thefilter/2026/oct/16/best-kettles';

	it.each([
		[id],
		[`/${id}`],
		[`/${id}/`],
		[`  ${id}  `],
		[`${id}?page=with:block-1#comments`],
		[`https://www.theguardian.com/${id}`],
		[`https://www.theguardian.com/${id}?CMP=share_btn_url`],
		[`https://m.code.dev-theguardian.com/${id}`],
		[`http://theguardian.com/${id}#block-2`],
	])('reads the CAPI ID from %s', (input) => {
		expect(articlePath(input)).toBe(id);
	});

	it.each([
		[''],
		['   '],
		['thefilter'],
		['https://www.theguardian.com/'],
		[`https://www.example.com/${id}`],
		[`https://theguardian.com.example.com/${id}`],
		['not a url/at all'],
		['https://'],
	])('rejects %p', (input) => {
		expect(articlePath(input)).toBeUndefined();
	});
});
