import { countLinks, linksCsv, renderedPageUrl } from './linkCounts';

describe('renderedPageUrl', () => {
	it.each([
		[
			'https://www.theguardian.com/thefilter/2024/nov/26/best-robot-vacuum-mop',
			'https://www.theguardian.com/thefilter/2024/nov/26/best-robot-vacuum-mop',
		],
		// CODE's articles are only served from its m. host.
		[
			'http://www.code.dev-theguardian.com/thefilter-us/2025/dec/30/stain-removers',
			'https://m.code.dev-theguardian.com/thefilter-us/2025/dec/30/stain-removers',
		],
		[
			'https://m.code.dev-theguardian.com/thefilter/2026/oct/06/an-article?x=1',
			'https://m.code.dev-theguardian.com/thefilter/2026/oct/06/an-article',
		],
	])('renders %s at %s', (webUrl, pageUrl) => {
		expect(renderedPageUrl(webUrl)).toBe(pageUrl);
	});

	it.each([
		'https://evil.example/thefilter/2026/oct/06/an-article',
		'https://www.theguardian.com.evil.example/thefilter',
		'http://localhost:3040/api/articles',
		'not a url',
	])('refuses %s', (webUrl) => {
		expect(renderedPageUrl(webUrl)).toBeUndefined();
	});
});

describe('countLinks', () => {
	const pageUrl =
		'https://www.theguardian.com/thefilter/2026/oct/06/an-article';
	const page = (...hrefs: string[]) =>
		hrefs.map((href) => `<a class="x" href="${href}">Link</a>`).join('\n');

	it('counts Amazon links, including through Skimlinks', () => {
		expect(
			countLinks(
				page(
					'https://www.amazon.co.uk/dp/B0F1',
					'https://www.amazon.com/dp/B0F2',
					'https://go.skimresources.com/?id=1&amp;url=https%3A%2F%2Fwww.amazon.co.uk%2Fdp%2FB0F3',
				),
				pageUrl,
			),
		).toEqual({ amazon: 3, skimlinks: 0, other: 0 });
	});

	it('counts other links through Skimlinks, and other external links', () => {
		expect(
			countLinks(
				page(
					'https://go.skimresources.com/?id=1&amp;url=https%3A%2F%2Fwww.johnlewis.com%2Fa',
					'https://www.johnlewis.com/a',
					'https://jobs.theguardian.com/',
				),
				pageUrl,
			),
		).toEqual({ amazon: 0, skimlinks: 1, other: 2 });
	});

	it('counts every link, repeats included, as the bookmarklet does', () => {
		expect(
			countLinks(
				page('https://www.argos.co.uk/a', 'https://www.argos.co.uk/a'),
				pageUrl,
			),
		).toEqual({ amazon: 0, skimlinks: 0, other: 2 });
	});

	it("leaves out links to the page's own site, and links that aren't to web pages", () => {
		expect(
			countLinks(
				`${page(
					'/uk',
					'https://www.theguardian.com/thefilter',
					'mailto:thefilter@theguardian.com',
					'#comments',
				)}<link href="https://www.amazon.co.uk/stylesheet">`,
				pageUrl,
			),
		).toEqual({ amazon: 0, skimlinks: 0, other: 0 });
	});

	it("treats links to www.theguardian.com as CODE's own site", () => {
		expect(
			countLinks(
				page(
					'https://www.theguardian.com/uk',
					'https://m.code.dev-theguardian.com/uk',
				),
				'https://m.code.dev-theguardian.com/thefilter/2026/oct/06/an-article',
			),
		).toEqual({ amazon: 0, skimlinks: 0, other: 0 });
	});

	it('reads links with single-quoted hrefs and other attributes first', () => {
		expect(
			countLinks(
				`<a data-link-name="product" rel="sponsored" href='https://www.amazon.com/dp/1'>x</a>`,
				pageUrl,
			),
		).toEqual({ amazon: 1, skimlinks: 0, other: 0 });
	});
});

describe('linksCsv', () => {
	const pageUrl =
		'https://www.theguardian.com/thefilter/2024/nov/26/best-robot-vacuum-mop';
	const html = `
		<h1>The best <em>robot</em> vacuums &amp; mops</h1>
		<a href="https://www.amazon.co.uk/dp/1">Amazon</a>
		<a href="https://go.skimresources.com/?id=1&amp;xs=1&amp;url=https%3A%2F%2Fwww.argos.co.uk%2Fp%2F1%3Fsref%3Dabc%26a%3D1">Argos</a>
		<a href="https://www.amazon.co.uk/dp/1">Amazon again</a>
		<a href="https://jobs.theguardian.com/">Jobs</a>
		<a href="https://www.youtube.com/@guardian">YouTube</a>`;

	it("lists each external link once, Amazon first, leaving out the bookmarklet's excluded hosts", () => {
		expect(linksCsv(html, pageUrl).split('\n')).toEqual([
			'"External Link","Is Affiliate Link?","Clean Product Link","TLD Domain","Page","Full Page Title","Short Title","Page URL Date"',
			`"https://www.amazon.co.uk/dp/1","No","https://www.amazon.co.uk/dp/1","amazon.co.uk","${pageUrl}","The best robot vacuums & mops","best-robot-vacuum-mop","2024/11/26"`,
			`"https://go.skimresources.com/?id=1&xs=1&url=https%3A%2F%2Fwww.argos.co.uk%2Fp%2F1%3Fsref%3Dabc%26a%3D1","Yes","https://www.argos.co.uk/p/1?a=1","argos.co.uk","${pageUrl}","The best robot vacuums & mops","best-robot-vacuum-mop","2024/11/26"`,
			`"https://www.youtube.com/@guardian","No","https://www.youtube.com/@guardian","youtube.com","${pageUrl}","The best robot vacuums & mops","best-robot-vacuum-mop","2024/11/26"`,
		]);
	});

	it('escapes quotes in fields', () => {
		const [, row] = linksCsv(
			'<h1>A "quoted" headline</h1><a href="https://shop.example/a">x</a>',
			pageUrl,
		).split('\n');

		expect(row).toContain('"A ""quoted"" headline"');
	});
});
