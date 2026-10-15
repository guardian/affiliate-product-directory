import { registerMetric } from '@common/cloudwatch';
import type { Product } from '@common/models';
import { PriceProvider } from '@price-update/price-providers/PriceProvider';
import {
	ShopifyProductResponseSchema,
	type ShopifyVariant,
} from '@price-update/price-providers/shopify/shopifyModels';

/**
 * Shopify storefronts expose a public JSON representation of any product page at `<product url>.json`,
 * so no auth is needed. Links that aren't Shopify product pages are skipped.
 */
export class ShopifyPriceProvider extends PriceProvider {
	/** Max concurrent requests, so we don't fire every product's request at once. */
	private readonly batchSize = 50;

	constructor() {
		super('shopify');
	}

	protected async fetchPrices(products: Product[]): Promise<Product[]> {
		console.log(`Fetching Shopify prices for ${products.length} products`);

		// Batches run sequentially and promise.all preserves index order within each,
		// so variants[i] still lines up with products[i].
		const variants: Array<ShopifyVariant | undefined> = [];
		for (const batch of this.chunk(products, this.batchSize)) {
			variants.push(
				...(await Promise.all(
					batch.map((product) => this.fetchFirstVariant(product)),
				)),
			);
		}

		const fetchedCount = variants.filter(Boolean).length;
		await registerMetric('ShopifyProductsFetched', fetchedCount);

		return this.updateProducts(products, variants);
	}

	/** Returns the product's first variant, or undefined if the link doesn't serve Shopify product JSON. */
	private async fetchFirstVariant(
		product: Product,
	): Promise<ShopifyVariant | undefined> {
		const endpoint = ShopifyPriceProvider.jsonUrl(product.productMerchantUrl);
		if (!endpoint) {
			console.log('ShopifyInvalidUrl', product.productMerchantUrl);
			return undefined;
		}

		try {
			return await this.withRetry(async () => {
				const response = await fetch(endpoint, {
					headers: { Accept: 'application/json' },
				});

				// Not a Shopify product page, no point retrying.
				if (response.status === 404) {
					return undefined;
				}
				if (!response.ok) {
					throw new Error(
						`Shopify product request failed: ${response.status} ${response.statusText}`,
					);
				}

				// A non-JSON body (e.g. an HTML page) also means this isn't a Shopify product.
				const parsed = ShopifyProductResponseSchema.safeParse(
					await response.json().catch(() => undefined),
				);
				if (!parsed.success) {
					console.log('ShopifyNoProductJson', product.productMerchantUrl);
					return undefined;
				}

				return parsed.data.product.variants[0];
			});
		} catch (error) {
			// One product failing shouldn't sink every other product's update.
			console.log('ShopifyRequestFailed', product.productMerchantUrl);
			return undefined;
		}
	}

	private updateProducts(
		products: Product[],
		variants: Array<ShopifyVariant | undefined>,
	): Product[] {
		const updated: Product[] = [];

		products.forEach((product, i) => {
			const variant = variants[i];
			const price = Number(variant?.price);

			if (!variant || !Number.isFinite(price)) {
				return;
			}

			updated.push(
				this.applyUpdate(product, {
					price,
					currency: variant.price_currency,
				}),
			);
		});

		return updated;
	}

	/** `https://shop.com/products/foo?ref=x` -> `https://shop.com/products/foo.json` */
	private static jsonUrl(productUrl: string): URL | undefined {
		try {
			const url = new URL(productUrl);
			url.search = '';
			url.hash = '';
			url.pathname = `${url.pathname.replace(/\/+$/, '')}.json`;
			return url;
		} catch {
			return undefined;
		}
	}
}
