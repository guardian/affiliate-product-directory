import {
	ComposerContentMessageSchema,
	composerOriginsForHost,
	composerOriginsForStage,
	sectionRegion,
} from './embed';

describe('ComposerContentMessageSchema', () => {
	const message = {
		source: 'composer',
		type: 'content',
		version: 1,
		composerId: '6720d1f38f08b1c3a9e5d27b',
		section: 'thefilter',
		elements: [{ elementType: 'text' }],
	};

	it('accepts a content message', () => {
		expect(ComposerContentMessageSchema.safeParse(message).success).toBe(true);
	});

	it('accepts an article with no section', () => {
		expect(
			ComposerContentMessageSchema.safeParse({ ...message, section: null })
				.success,
		).toBe(true);
	});

	it.each([
		['another source', { source: 'pinboard' }],
		['another type', { type: 'height' }],
		['another version', { version: 2 }],
		['no elements', { elements: undefined }],
	])('rejects a message from %s', (_name, change) => {
		expect(
			ComposerContentMessageSchema.safeParse({ ...message, ...change }).success,
		).toBe(false);
	});
});

describe('composerOriginsForStage', () => {
	it("lets only PROD's Composer frame PROD's tool", () => {
		expect(composerOriginsForStage('PROD')).toEqual([
			'https://composer.gutools.co.uk',
		]);
	});

	it.each(['CODE', 'DEV'])(
		"lets CODE's and local Composer frame %s",
		(stage) => {
			expect(composerOriginsForStage(stage)).toEqual([
				'https://composer.code.dev-gutools.co.uk',
				'https://composer.local.dev-gutools.co.uk',
			]);
		},
	);
});

describe('composerOriginsForHost', () => {
	it("accepts only PROD's Composer on PROD's tool", () => {
		expect(
			composerOriginsForHost({
				hostname: 'affiliate-products.gutools.co.uk',
				origin: 'https://affiliate-products.gutools.co.uk',
			}),
		).toEqual(['https://composer.gutools.co.uk']);
	});

	it("doesn't accept the tool's own origin outside local dev", () => {
		const origin = 'https://affiliate-products.code.dev-gutools.co.uk';
		expect(
			composerOriginsForHost({
				hostname: 'affiliate-products.code.dev-gutools.co.uk',
				origin,
			}),
		).not.toContain(origin);
	});

	it.each([
		['localhost', 'http://localhost:5173'],
		[
			'affiliate-products.local.dev-gutools.co.uk',
			'https://affiliate-products.local.dev-gutools.co.uk',
		],
	])('accepts the dev harness on %s', (hostname, origin) => {
		expect(
			composerOriginsForHost({
				hostname,
				origin,
			}),
		).toEqual([
			'https://composer.code.dev-gutools.co.uk',
			'https://composer.local.dev-gutools.co.uk',
			origin,
		]);
	});
});

describe('sectionRegion', () => {
	it.each([
		['thefilter-us', 'US'],
		['thefilter', 'GB'],
		['technology', 'GB'],
		[null, 'GB'],
	])('prices %s in %s', (section, region) => {
		expect(sectionRegion(section)).toBe(region);
	});
});
