import { emitMetric } from '../../../../common/src/metrics';
import { groupByRegion, REGIONS } from '../../models';
import type { Product, Region } from '../../models';
import { PriceProvider } from '../PriceProvider';
import {
	getSkimlinksAccessToken,
	getSkimlinksCredentials,
} from './skimlinksAuth';

export class SkimlinksPriceProvider extends PriceProvider {
	protected readonly name = 'skimlinks';
	private readonly batchSize = 100;

	public async refreshPrices(products: Product[]): Promise<Product[]> {
		const productData = await this.fetchProductData(products);
		return this.updateProducts(products, productData);
	}

	private async fetchProductData(
		products: Product[],
	): Promise<SkimlinksProductData> {
		const { publisherId, publisherDomainId } = await getSkimlinksCredentials();
		const accessToken = await getSkimlinksAccessToken();
		const byRegion = groupByRegion(products);
		const productData: SkimlinksProductData = {};

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
	}): Promise<SkimlinksProductData> {
		const endpoint = new URL(
			`https://products.skimapis.com/v1/publisher/${publisherId}/products`,
		);
		endpoint.searchParams.set('access_token', accessToken);
		endpoint.searchParams.set('publisher_domain_id', publisherDomainId);
		endpoint.searchParams.set('exclude_domains', '');
		endpoint.searchParams.set('referrer_url', 'theguardian.com');
		endpoint.searchParams.set('per_merchant_limit', '1');
		endpoint.searchParams.set('country_code', COUNTRY_CODE[region]);
		endpoint.searchParams.set('product_id_type', 'asin');
		endpoint.searchParams.set('alternatives_size', '0');

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
			return (await response.json()) as SkimlinksProductsResponse;
		});

		return results;
	}

	private updateProducts(
		products: Product[],
		productData: SkimlinksProductData,
	): Product[] {
		const updated: Product[] = [];

		for (const product of products) {
			const match = productData[product.productMerchantUrl]?.[0];

			if (!match) {
				emitMetric('SkimlinksNoData');
				continue;
			}

			emitMetric('SkimlinksDataRetrieved');
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

type SkimlinksMatch = {
	input_url: string;
	price: number;
	currency: string;
};
type SkimlinksProductData = Record<string, SkimlinksMatch[]>;
type SkimlinksProductsResponse = { results: SkimlinksProductData };
const COUNTRY_CODE: Record<Region, string> = { UK: 'GB', US: 'US' };
