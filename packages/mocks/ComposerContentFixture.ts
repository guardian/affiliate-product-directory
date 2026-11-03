import type { ComposerContentMessage } from '@common/embed';

/**
 * A content message as Composer sends it to the embed, in the shape of the sample saved
 * in flexible-content (flexible-frontend/src/fixtures/affiliate-products-content.sample.json).
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
				id: '3f6b2a8e-1c4d-4e5f-9a7b-2c3d4e5f6a7b',
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
			elementType: 'link-element',
			fields: {
				label: '£199 at Argos',
				url: 'https://www.argos.co.uk/product/example-shark',
				linkType: 'PRODUCT_BUTTON',
				priority: 'PRIMARY',
			},
			assets: [],
		},
		{
			elementType: 'image',
			fields: { caption: 'The Shark Stratos' },
			assets: [],
		},
		{
			elementType: 'product-summary',
			fields: {
				title: 'At a glance',
				displayType: 'CTA_LIST',
				products: [
					{ productId: '3f6b2a8e-1c4d-4e5f-9a7b-2c3d4e5f6a7b', ctaIndex: 0 },
				],
			},
			assets: [],
		},
	],
};
