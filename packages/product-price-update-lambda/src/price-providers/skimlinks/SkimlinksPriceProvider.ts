import type { Product } from '@common/models';
import type { SkimlinksProductsResponse } from '@price-update/models';
import {
	groupByRegion,
	type Region,
	REGIONS,
	SkimlinksProductsResponseSchema,
} from '@price-update/models';
import { PriceProvider } from '@price-update/price-providers/PriceProvider';
import {
	getSkimlinksAccessToken,
	getSkimlinksCredentials,
} from '@price-update/price-providers/skimlinks/skimlinksAuth';

export class SkimlinksPriceProvider extends PriceProvider {
	protected readonly name = 'skimlinks';
	private readonly batchSize = 100;

	public async refreshPrices(products: Product[]): Promise<Product[]> {
		console.log(`Fetching Skimlinks prices for ${products.length} products`);
		const productData = await this.fetchProductData(products);
		return this.updateProducts(products, productData);
	}

	private async fetchProductData(
		products: Product[],
	): Promise<SkimlinksProductsResponse['results']> {
		const { publisherId, publisherDomainId } = await getSkimlinksCredentials();
		const accessToken = await getSkimlinksAccessToken();
		const byRegion = groupByRegion(products);
		const productData: SkimlinksProductsResponse['results'] = {};

		for (const region of REGIONS) {
			for (const batch of this.chunk(byRegion[region], this.batchSize)) {
				const results = await this.batchRequest({
					batch,
					region,
					publisherId,
					publisherDomainId: publisherDomainId[region],
					accessToken,
				});

				Object.assign(productData, results);
			}
		}

		return productData;
	}

	private async batchRequest({
		batch,
		region,
		publisherId,
		publisherDomainId,
		accessToken,
	}: {
		batch: Product[];
		region: Region;
		publisherId: string;
		publisherDomainId: string;
		accessToken: string;
	}): Promise<SkimlinksProductsResponse['results']> {
		const params = new URLSearchParams({
			access_token: accessToken,
			publisher_domain_id: publisherDomainId,
			exclude_domains: '',
			referrer_url: 'theguardian.com',
			per_merchant_limit: '1',
			country_code: COUNTRY_CODE[region],
			product_id_type: 'asin',
			alternatives_size: '0',
		});

		const endpoint = new URL(
			`https://products.skimapis.com/v1/publisher/${publisherId}/products?${params}`,
		);

		const { results } = await this.withRetry(async () => {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					product_urls: batch.map((product) => product.productMerchantUrl),
				}),
			});
			if (!response.ok) {
				throw new Error(
					`Skimlinks products request failed: ${response.status} ${response.statusText}`,
				);
			}
			return SkimlinksProductsResponseSchema.parse(await response.json());
		});

		return results;
	}

	private updateProducts(
		products: Product[],
		productData: SkimlinksProductsResponse['results'],
	): Product[] {
		const updated: Product[] = [];

		for (const product of products) {
			const match = productData[product.productMerchantUrl]?.[0];

			if (!match) {
				// ToDo: investigate metrics in cloudwatch
				console.log('SkimlinksNoData');
				continue;
			}

			console.log('SkimlinksDataRetrieved');
			updated.push(
				this.applyUpdate(product, {
					price: match.price,
					currency: match.currency,
				}),
			);
		}

		return updated;
	}
}

const COUNTRY_CODE: Record<Region, string> = { UK: 'GB', US: 'US' };
