import { PreviewRequestSchema } from './requestSchema';

describe('PreviewRequestSchema', () => {
	describe('valid URLs', () => {
		it('accepts valid public HTTP URLs', () => {
			const request = {
				products: [
					{
						productMerchantUrl: 'http://example.com/product',
						region: 'GB',
					},
				],
			};
			const result = PreviewRequestSchema.safeParse(request);
			expect(result.success).toBe(true);
		});

		it('accepts valid public HTTPS URLs', () => {
			const request = {
				products: [
					{
						productMerchantUrl: 'https://shop.example.co.uk/products/item',
						region: 'US',
					},
				],
			};
			const result = PreviewRequestSchema.safeParse(request);
			expect(result.success).toBe(true);
		});

		it('accepts URLs with query strings and fragments', () => {
			const request = {
				products: [
					{
						productMerchantUrl: 'https://example.com/product?ref=123#section',
						region: 'GB',
					},
				],
			};
			const result = PreviewRequestSchema.safeParse(request);
			expect(result.success).toBe(true);
		});

		it('accepts multiple products', () => {
			const request = {
				products: [
					{
						productMerchantUrl: 'https://shop1.com/product',
						region: 'GB',
					},
					{
						productMerchantUrl: 'https://shop2.com/item',
						region: 'US',
					},
				],
			};
			const result = PreviewRequestSchema.safeParse(request);
			expect(result.success).toBe(true);
		});
	});

	describe('SSRF attack prevention', () => {
		describe('loopback addresses', () => {
			it('rejects 127.0.0.1', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://127.0.0.1:8080/admin',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});

			it('rejects ::1 (IPv6 loopback)', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://[::1]:8080/admin',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});
		});

		describe('private network ranges', () => {
			it('rejects 10.0.0.0/8', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://10.0.0.5/internal',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});

			it('rejects 172.16.0.0/12', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://172.20.0.5/internal',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});

			it('rejects 192.168.0.0/16', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://192.168.1.1/admin',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});
		});

		describe('link-local and metadata addresses', () => {
			it('rejects 169.254.0.0/16 (link-local)', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://169.254.1.1/metadata',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});

			it('rejects AWS metadata service endpoint', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://169.254.169.254/latest/meta-data/',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});
		});

		describe('invalid schemes', () => {
			it('rejects non-URL strings', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'not a valid url',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});

			it('rejects URLs without hostname', () => {
				const request = {
					products: [
						{
							productMerchantUrl: 'http://',
							region: 'GB',
						},
					],
				};
				const result = PreviewRequestSchema.safeParse(request);
				expect(result.success).toBe(false);
			});
		});
	});
});
