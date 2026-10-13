import { S3ServiceException } from '@aws-sdk/client-s3';
import type { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ArticlesPageSchema } from '@common/tool-models';
import type { ArticlesPage } from '@common/tool-models';
import { jest } from '@jest/globals';
import { attachProductPrices, createProductPrices } from './productPrices';
import type { ProductPrices } from './types';

const pricedItem = {
	productMerchantUrl: 'https://shop.example/a',
	region: 'GB',
	createdAt: 1750000000000,
	currency: 'GBP',
	price: 24.5,
	updatedAt: 1760000000000,
	updatedBy: 'skimlinks',
};

// An item without a price. The price update Lambda leaves these out of the file, but
// the tool copes with one.
const unpricedItem = {
	productMerchantUrl: 'https://shop.example/b',
	region: 'US',
};

const pricesFile = {
	[pricedItem.productMerchantUrl]: pricedItem,
	[unpricedItem.productMerchantUrl]: unpricedItem,
};

const fileResponse = (file: unknown, etag = '"etag-1"') => ({
	Body: { transformToString: () => Promise.resolve(JSON.stringify(file)) },
	ETag: etag,
});

// What the S3 client throws when a file still has the ETag a read was given.
const notModified = () =>
	new S3ServiceException({
		name: 'Unknown',
		$fault: 'client',
		$metadata: { httpStatusCode: 304 },
	});

describe('createProductPrices', () => {
	const s3Send = jest.fn<(command: GetObjectCommand) => Promise<unknown>>();

	const productPrices = () =>
		createProductPrices({
			bucket: 'test-bucket',
			key: 'TEST/affiliates/cached-product-prices.json',
			s3Client: { send: s3Send } as unknown as S3Client,
		});

	const readInputs = () => s3Send.mock.calls.map(([command]) => command.input);

	beforeEach(() => {
		s3Send.mockReset();
		s3Send.mockResolvedValue(fileResponse(pricesFile));
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('reads the file from the given bucket and key', async () => {
		await productPrices()();

		expect(readInputs()).toEqual([
			{
				Bucket: 'test-bucket',
				Key: 'TEST/affiliates/cached-product-prices.json',
			},
		]);
	});

	it("returns each product's price by its URL, without the item's other fields", async () => {
		const prices = await productPrices()();

		expect([...prices]).toEqual([
			[
				'https://shop.example/a',
				{
					currency: 'GBP',
					price: 24.5,
					updatedAt: 1760000000000,
					updatedBy: 'skimlinks',
				},
			],
			['https://shop.example/b', {}],
		]);
	});

	it('asks S3 on every request, for the file only if it has changed', async () => {
		const getProductPrices = productPrices();
		await getProductPrices();

		s3Send.mockRejectedValue(notModified());
		await getProductPrices();
		await getProductPrices();

		expect(readInputs().map(({ IfNoneMatch }) => IfNoneMatch)).toEqual([
			undefined,
			'"etag-1"',
			'"etag-1"',
		]);
	});

	it('reuses its copy of the file while the file has not changed', async () => {
		const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
		const getProductPrices = productPrices();
		const first = await getProductPrices();

		s3Send.mockRejectedValue(notModified());
		const second = await getProductPrices();

		expect(second).toBe(first);
		expect(logError).not.toHaveBeenCalled();
	});

	it('replaces its copy once the file has changed', async () => {
		const getProductPrices = productPrices();
		await getProductPrices();

		s3Send.mockResolvedValueOnce(
			fileResponse(
				{ 'https://shop.example/a': { ...pricedItem, price: 19.99 } },
				'"etag-2"',
			),
		);
		const prices = await getProductPrices();

		expect(prices.get('https://shop.example/a')?.price).toBe(19.99);
		expect(prices.has('https://shop.example/b')).toBe(false);

		// The next request is for a file that has changed since the new copy.
		s3Send.mockRejectedValue(notModified());
		expect(await getProductPrices()).toBe(prices);
		expect(readInputs()[2]?.IfNoneMatch).toBe('"etag-2"');
	});

	it('asks S3 once for requests that arrive together', async () => {
		const getProductPrices = productPrices();

		const [first, second] = await Promise.all([
			getProductPrices(),
			getProductPrices(),
		]);

		expect(s3Send).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
	});

	it.each([
		[
			'S3 cannot be reached',
			() => Promise.reject(new Error('S3 is unavailable')),
		],
		[
			'the changed file is not the expected shape',
			() => Promise.resolve(fileResponse([pricedItem], '"etag-2"')),
		],
	])('keeps using its copy when %s', async (_description, respond) => {
		const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
		const getProductPrices = productPrices();
		const first = await getProductPrices();

		s3Send.mockImplementationOnce(respond);
		const second = await getProductPrices();

		expect(second).toBe(first);
		expect(logError).toHaveBeenCalledTimes(1);
		// The next request asks again, still against the copy it kept.
		await getProductPrices();
		expect(readInputs()[2]?.IfNoneMatch).toBe('"etag-1"');
	});

	it('fails when the file cannot be read and it has no copy', async () => {
		s3Send.mockRejectedValueOnce(new Error('S3 is unavailable'));
		const getProductPrices = productPrices();

		await expect(getProductPrices()).rejects.toThrow('S3 is unavailable');
		// A later request tries again rather than repeating the failure.
		expect((await getProductPrices()).size).toBe(2);
	});

	it.each([
		['a list', [pricedItem]],
		[
			'a price that is not a number',
			{ 'https://shop.example/a': { ...pricedItem, price: '24.50' } },
		],
	])('fails when the file has %s', async (_description, file) => {
		s3Send.mockResolvedValue(fileResponse(file));

		await expect(productPrices()()).rejects.toThrow();
	});

	it('fails when the file has no content', async () => {
		s3Send.mockResolvedValue({});

		await expect(productPrices()()).rejects.toThrow(
			's3://test-bucket/TEST/affiliates/cached-product-prices.json has no content',
		);
	});
});

describe('attachProductPrices', () => {
	const page: ArticlesPage = {
		articles: [
			{
				id: 'thefilter/2026/oct/06/an-article',
				sectionId: 'thefilter',
				webPublicationDate: '2026-10-06T09:00:00Z',
				webTitle: 'An article',
				webUrl: 'https://www.theguardian.com/thefilter/2026/oct/06/an-article',
				ophanUrl:
					'https://dashboard.ophan.co.uk/info?capi-id=thefilter%2F2026%2Foct%2F06%2Fan-article',
				products: [
					{
						url: 'https://shop.example/a',
						label: '£27 at Shop',
						productName: 'A product',
						basePrice: { currencySymbol: '£', amount: 27 },
					},
					{ url: 'https://shop.example/b', label: 'Buy at Shop' },
					{ url: 'https://shop.example/c', label: '$5 at Shop' },
				],
			},
		],
		currentPage: 1,
		pages: 3,
		total: 60,
	};

	const prices: ProductPrices = new Map([
		[
			'https://shop.example/a',
			{
				currency: 'GBP',
				price: 24.5,
				updatedAt: 1760000000000,
				updatedBy: 'skimlinks',
			},
		],
		// In the directory, but not yet priced.
		['https://shop.example/b', {}],
	]);

	it("adds the directory's price to the products it has priced", () => {
		const { articles } = attachProductPrices(page, prices);

		expect(articles[0]?.products).toEqual([
			{
				url: 'https://shop.example/a',
				label: '£27 at Shop',
				productName: 'A product',
				basePrice: { currencySymbol: '£', amount: 27 },
				currency: 'GBP',
				price: 24.5,
				updatedAt: 1760000000000,
				updatedBy: 'skimlinks',
			},
			{ url: 'https://shop.example/b', label: 'Buy at Shop' },
			{ url: 'https://shop.example/c', label: '$5 at Shop' },
		]);
	});

	it('leaves the rest of the page as it was', () => {
		const { articles, ...paging } = attachProductPrices(page, prices);

		expect(paging).toEqual({ currentPage: 1, pages: 3, total: 60 });
		expect({ ...articles[0], products: [] }).toEqual({
			...page.articles[0],
			products: [],
		});
	});

	it('returns a page the client accepts', () => {
		// As the client receives it, once sent as JSON.
		const sent: unknown = JSON.parse(
			JSON.stringify(attachProductPrices(page, prices)),
		);

		expect(ArticlesPageSchema.parse(sent)).toEqual(sent);
	});
});
