import { bodyLinks, countLinks, linksCsv } from './linkCounts';
import type { Block } from './types';

// The Skimlinks merchants' domains, as in the file in S3.
const skimlinksDomains = new Set(['argos.co.uk', 'johnlewis.com']);

const text = (html: string) => ({ type: 'text', textTypeData: { html } });

describe('bodyLinks', () => {
	it("reads the links in the body's text, product buttons and product cards, in order", () => {
		const body: Block[] = [
			{
				elements: [
					text(
						`<p><a href="https://shop.example/a?x=1&amp;y=2">A</a> and <a data-x="1" href='https://shop.example/b'>B</a></p>`,
					),
					{
						type: 'link',
						linkTypeData: {
							url: 'https://shop.example/c',
							linkType: 'product-button',
						},
					},
					{
						type: 'product',
						productTypeData: {
							productCtas: [
								{
									url: 'https://shop.example/d',
									text: '',
									retailer: '',
									price: '',
								},
								// A link on a card that hasn't been filled in.
								{ url: '', text: '', retailer: '', price: '' },
							],
							content: [
								{
									type: 'link',
									linkTypeData: { url: 'https://shop.example/e' },
								},
							],
						},
					},
				],
			},
			{ elements: [text('<p>No links</p>')] },
			{},
		];

		expect(bodyLinks(body)).toEqual([
			'https://shop.example/a?x=1&y=2',
			'https://shop.example/b',
			'https://shop.example/c',
			'https://shop.example/d',
			'https://shop.example/e',
		]);
	});
});

describe('countLinks', () => {
	const count = (...links: string[]) => countLinks(links, skimlinksDomains);

	it('counts Amazon links, including through Skimlinks', () => {
		expect(
			count(
				'https://www.amazon.co.uk/dp/B0F1',
				'https://www.amazon.com/dp/B0F2',
				'https://go.skimresources.com/?id=1&url=https%3A%2F%2Fwww.amazon.co.uk%2Fdp%2FB0F3',
			),
		).toEqual({ amazon: 3, skimlinks: 0, other: 0 });
	});

	it("counts links to Skimlinks' merchants, and links already through Skimlinks, as Skimlinks links", () => {
		expect(
			count(
				'https://www.johnlewis.com/a',
				'https://argos.co.uk/b',
				'https://go.skimresources.com/?id=1&url=https%3A%2F%2Fshop.example%2Fa',
				'https://shop.example/a',
			),
		).toEqual({ amazon: 0, skimlinks: 3, other: 1 });
	});

	it("doesn't count a merchant's subdomain as theirs, as frontend doesn't", () => {
		expect(count('https://help.johnlewis.com/a')).toEqual({
			amazon: 0,
			skimlinks: 0,
			other: 1,
		});
	});

	it("doesn't count links that only mention Amazon or Skimlinks as theirs", () => {
		expect(
			count(
				'https://www.amazon.com.shop.example/a',
				'https://shop.example/?from=amazon.co.uk',
				'https://skimresources.shop.example/a',
				'https://go.skimresources.com/?id=1&url=https%3A%2F%2Fshop.example%2F%3Ffrom%3Damazon.com',
			),
		).toEqual({ amazon: 0, skimlinks: 1, other: 3 });
	});

	it('counts every link, repeats included, as the bookmarklet does', () => {
		expect(
			count('https://www.example.com/a', 'https://www.example.com/a'),
		).toEqual({ amazon: 0, skimlinks: 0, other: 2 });
	});

	it("leaves out links to the Guardian's sites, and links that aren't to web pages", () => {
		expect(
			count(
				'/uk',
				'https://www.theguardian.com/thefilter',
				'https://jobs.theguardian.com/',
				'https://m.code.dev-theguardian.com/uk',
				'mailto:thefilter@theguardian.com',
				'#comments',
			),
		).toEqual({ amazon: 0, skimlinks: 0, other: 0 });
	});
});

describe('linksCsv', () => {
	const webUrl =
		'https://www.theguardian.com/thefilter/2024/nov/26/best-robot-vacuum-mop';
	const webTitle = 'The best robot vacuums & mops';
	const csv = (...links: string[]) =>
		linksCsv({ webUrl, webTitle, links }, skimlinksDomains).split('\n');
	const page = `"${webUrl}","${webTitle}","best-robot-vacuum-mop","2024/11/26"`;

	it('lists each external link once, Amazon first, then Skimlinks links, then the rest', () => {
		expect(
			csv(
				'https://www.youtube.com/@guardian',
				'https://www.amazon.co.uk/dp/1',
				'https://go.skimresources.com/?id=1&xs=1&url=https%3A%2F%2Fshop.example%2Fp%2F1%3Fsref%3Dabc%26a%3D1',
				'https://www.argos.co.uk/p/2',
				'https://www.amazon.co.uk/dp/1',
				'https://jobs.theguardian.com/',
			),
		).toEqual([
			'"External Link","Is Affiliate Link?","Clean Product Link","TLD Domain","Page","Full Page Title","Short Title","Page URL Date"',
			`"https://www.amazon.co.uk/dp/1","No","https://www.amazon.co.uk/dp/1","amazon.co.uk",${page}`,
			`"https://go.skimresources.com/?id=1&xs=1&url=https%3A%2F%2Fshop.example%2Fp%2F1%3Fsref%3Dabc%26a%3D1","Yes","https://shop.example/p/1?a=1","shop.example",${page}`,
			`"https://www.argos.co.uk/p/2","Yes","https://www.argos.co.uk/p/2","argos.co.uk",${page}`,
			`"https://www.youtube.com/@guardian","No","https://www.youtube.com/@guardian","youtube.com",${page}`,
		]);
	});

	it('escapes quotes in fields', () => {
		const [, row] = linksCsv(
			{
				webUrl,
				webTitle: 'A "quoted" headline',
				links: ['https://shop.example/a'],
			},
			skimlinksDomains,
		).split('\n');

		expect(row).toContain('"A ""quoted"" headline"');
	});
});
