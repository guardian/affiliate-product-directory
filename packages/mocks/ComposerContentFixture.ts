import type { ComposerContentMessage } from '@common/embed';

/**
 * A content message as Composer would send it to the embed.
 *
 * GUESSED: the element shapes follow flexible-model's (elementType and string fields), but
 * haven't been checked against a real message. Replace them with the sample the Composer
 * change saves, then fix composerElements.ts to match.
 */
export const composerContentFixture: ComposerContentMessage = {
	source: 'composer',
	type: 'content',
	version: 1,
	composerId: '6720d1f38f08b1c3a9e5d27b',
	section: 'thefilter',
	elements: [
		{
			elementType: 'text',
			fields: {
				text: '<p>We tested 14 cordless vacuums on carpet, hard floors and pet hair.</p>',
			},
		},
		{
			elementType: 'product',
			fields: {
				productName: 'V15 Detect',
				brandName: 'Dyson',
				productCtas: [
					{
						url: 'https://www.amazon.co.uk/dp/B0EXAMPLE15',
						text: '',
						retailer: 'Amazon',
						price: '£549',
					},
					{
						url: 'https://www.johnlewis.com/dyson-v15-detect/p-example',
						text: '',
						retailer: 'John Lewis',
						price: '£599',
					},
				],
			},
		},
		{
			elementType: 'text',
			fields: { text: '<h2>Best budget: Shark Stratos</h2>' },
		},
		{
			elementType: 'link',
			fields: {
				linkType: 'product-button',
				url: 'https://www.argos.co.uk/product/example-shark',
				label: '£199 at Argos',
			},
		},
		{ elementType: 'image', fields: { caption: 'The Shark Stratos' } },
	],
};
