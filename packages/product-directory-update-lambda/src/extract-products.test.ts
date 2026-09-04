import type { Block } from '@guardian/content-api-models/v1/block';
import type { BlockElement } from '@guardian/content-api-models/v1/blockElement';
import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import { ElementType } from '@guardian/content-api-models/v1/elementType';
import { LinkType } from '@guardian/content-api-models/v1/linkType';
import { Priority } from '@guardian/content-api-models/v1/priority';
import { ProductDisplayType } from '@guardian/content-api-models/v1/productDisplayType';
import { extractAllProductsFromArticle } from './extract-products';

const canonicalId = 'thefilter/2026/jul/21/best-cat-toys-tested-uk';

const content: Content = {
	id: canonicalId,
	type: ContentType.ARTICLE,
	webTitle:
		'The best cat toys in the UK, tested by cats: ‘sent the kittens scarpering’',
	webUrl: `https://www.theguardian.com/${canonicalId}`,
	apiUrl: `https://content.guardianapis.com/${canonicalId}`,
	tags: [],
	references: [],
	isHosted: false,
};

const block: Block = {
	id: '5a4b754ce4b0e33567c465c7',
	bodyHtml: '',
	bodyTextSummary: '',
	attributes: {},
	published: true,
	contributors: [],
	elements: [],
};

const productElement: BlockElement = {
	type: ElementType.PRODUCT,
	assets: [],
	productTypeData: {
		productName: 'Colourful long raffia tail teaser sticks',
		brandName: 'Nature’s Goodies',
		primaryHeading: '<em>Best cat toy overall:</em>',
		secondaryHeading:
			'Nature’s Goodies colourful long raffia tail teaser sticks',
		displayType: ProductDisplayType.INLINE_WITH_PRODUCT_CARD,
		starRating: 'none-selected',
		productCtas: [
			{
				url: 'https://www.etsy.com/uk/listing/1798629224/colourful-long-raffia-tail-teaser-sticks',
				text: '',
				retailer: 'Etsy',
				price: '£12.50',
			},
			{
				url: 'https://www.ebay.co.uk/itm/315870795819',
				text: '',
				retailer: 'eBay',
				price: '£12.50',
			},
		],
		customAttributes: [
			{
				name: 'What we love',
				value: 'Beautifully made from natural materials',
			},
			{
				name: 'What we don’t love',
				value: 'Costs more than the average teaser toy',
			},
		],
		image: {
			caption:
				'Colourful Long Raffia Tail Teaser Sticks Wands Cat Toys - Eco Friendly Boredom Breakers Vegan Colours Blue Green Pink Red Lilac Mauve Yellow\nNaturesGoodiesGB',
			displayCredit: false,
			source: 'PR Image',
			photographer: '',
			alt: "Nature's Goodies' Colourful long raffia tail teaser sticks cat toy.",
			mediaId: '32671404f5a8efceb518c61e96008341c65208ef',
			file: 'https://media.guim.co.uk/32671404f5a8efceb518c61e96008341c65208ef/0_0_725_725/725.jpg',
			imageType: 'Photograph',
			height: 725,
			width: 725,
			credit: 'Photograph: /PR Image',
		},
		content: [
			{
				type: ElementType.LINK,
				assets: [],
				linkTypeData: {
					label: '£12.50 at Etsy',
					url: 'https://www.etsy.com/uk/listing/1798629224/colourful-long-raffia-tail-teaser-sticks',
					linkType: LinkType.PRODUCT_BUTTON,
					priority: Priority.PRIMARY,
				},
			},
			{
				type: ElementType.LINK,
				assets: [],
				linkTypeData: {
					label: '£12.50 at eBay',
					url: 'https://www.ebay.co.uk/itm/315870795819',
					linkType: LinkType.PRODUCT_BUTTON,
					priority: Priority.PRIMARY,
				},
			},
			{
				type: ElementType.TEXT,
				assets: [],
				textTypeData: {
					html: '<p>Rare is the cat who will not respond to a well-chosen teaser. I love toys of this type, as they encourage playful interaction between you and your cat. (Top tip: try trailing one around chair legs or behind items of furniture.)</p> \n<p><strong>Why we love it<br></strong>The best teasers I’ve come across are made by Nature’s Goodies, which sent a selection of beautiful, all-natural teaser toys for our feline testers to review. There are various types, but it’s this raffia option that caused my cat, Martha, to fall head over paws. While I happily wielded the wooden handle, she gamely chased its grass-like bunch of natural strands, made from palm leaves. The rustling sound of the teaser moving across the floor dialled up the excitement – especially when I moved it around while it was out of her sight, behind the sofa.</p> \n<p>Other teasers from the brand’s range, such as <a href="https://www.etsy.com/uk/listing/4429707410/vegan-all-natural-feathered-sisal">this feathered sisal twizzle model</a>, hit the spot with Dianne’s rescue kittens, and Vanda’s foster cat Hovis. All of these toys seemed well made, and the natural materials make a nice change from the synthetics used in many cat toys.</p> \n<p><strong>It’s a shame that …</strong> many cats will eventually tire of a teaser toy – even a good one. I’d recommend buying a few different types to maintain interest.</p> \n<p><strong>Type:</strong> manual (interactive)<br><strong>Motivation:</strong> moving prey<br><strong>Materials:</strong> raffia, pine wood</p>',
				},
			},
			{
				type: ElementType.LINK,
				assets: [],
				linkTypeData: {
					label: '£10 at Argos',
					url: 'https://www.argos.co.uk/itm/315870795819',
					linkType: LinkType.PRODUCT_BUTTON,
					priority: Priority.PRIMARY,
				},
			},
		],
		id: '6c7531d315cd428bab6ba74c613b143c',
	},
};

describe('extractAllProductsFromArticle', () => {
	it('should extract all unique URLs from product CTAs and product links in content', () => {
		const result = extractAllProductsFromArticle({
			...content,
			blocks: {
				body: [{ ...block, elements: [productElement] }],
			},
		});

		expect(result.length).toEqual(3);
		expect(result.map((r) => r.article.productMerchantUrl)).toEqual([
			'https://www.etsy.com/uk/listing/1798629224/colourful-long-raffia-tail-teaser-sticks',
			'https://www.ebay.co.uk/itm/315870795819',
			'https://www.argos.co.uk/itm/315870795819',
		]);
	});
});
