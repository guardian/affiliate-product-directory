import type { Product } from '@common/models';
import { type Region, regionOf, REGIONS } from '@price-update/models';
import {
	getAmazonAccessToken,
	getAmazonCredentials,
} from '@price-update/price-providers/amazon/amazonAuth';
import {
	AmazonGetItemsResponseSchema,
	type AmazonItem,
} from '@price-update/price-providers/amazon/amazonModels';
import { PriceProvider } from '@price-update/price-providers/PriceProvider';

const AMAZON_CREATORS_API_BASE_URL = 'https://creatorsapi.amazon/catalog/v1';
const MARKETPLACE: Record<Region, string> = {
	UK: 'www.amazon.co.uk',
	US: 'www.amazon.com',
};

interface ProductWithAsin {
	product: Product;
	asin: string;
}

export class AmazonPriceProvider extends PriceProvider {
	protected readonly name = 'amazon';
	private readonly batchSize = 10;
	private readonly minMsBetweenRequests = 1000;

	private static readonly ASIN_REGEX = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/;

	public async refreshPrices(products: Product[]): Promise<Product[]> {
		console.log(`Fetching Amazon prices for ${products.length} products`);
		const withAsin = this.extractAsins(products);
		const itemsByAsin = await this.fetchItemData(withAsin);
		return this.updateProducts(withAsin, itemsByAsin);
	}

	private extractAsins(products: Product[]): ProductWithAsin[] {
		const withAsin: ProductWithAsin[] = [];

		for (const product of products) {
			const match = AmazonPriceProvider.ASIN_REGEX.exec(
				product.productMerchantUrl,
			);

			if (!match) {
				console.log('AmazonAsinExtractionFailed', product.productMerchantUrl);
				continue;
			}

			withAsin.push({ product, asin: match[1]! });
		}

		return withAsin;
	}

	private async fetchItemData(
		withAsin: ProductWithAsin[],
	): Promise<Record<string, AmazonItem>> {
		const credentials = await getAmazonCredentials();
		const itemsByAsin: Record<string, AmazonItem> = {};

		for (const region of REGIONS) {
			const regionEntries = withAsin.filter(
				({ product }) => regionOf(product) === region,
			);
			if (regionEntries.length === 0) {
				continue;
			}

			const accessToken = await getAmazonAccessToken(region);

			for (const batch of this.chunk(regionEntries, this.batchSize)) {
				try {
					const items = await this.batchRequest({
						region,
						accessToken,
						partnerTag: credentials.partnerTag[region],
						asins: batch.map(({ asin }) => asin),
					});

					for (const item of items) {
						itemsByAsin[item.asin] = item;
					}
				} catch (error) {
					// A single batch failing shouldn't sink every other product's update.
					console.log('AmazonBatchFailed', region, error);
				}

				await this.sleep(this.minMsBetweenRequests);
			}
		}

		return itemsByAsin;
	}

	private async batchRequest({
		region,
		accessToken,
		partnerTag,
		asins,
	}: {
		region: Region;
		accessToken: string;
		partnerTag: string;
		asins: string[];
	}): Promise<AmazonItem[]> {
		const marketplace = MARKETPLACE[region];

		return this.withRetry(async () => {
			const response = await fetch(`${AMAZON_CREATORS_API_BASE_URL}/getItems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
					'x-marketplace': marketplace,
				},
				body: JSON.stringify({
					itemIds: asins,
					itemIdType: 'ASIN',
					marketplace,
					partnerTag,
					resources: [
						'itemInfo.title',
						'itemInfo.externalIds',
						'itemInfo.byLineInfo',
						'itemInfo.manufactureInfo',
						'offersV2.listings.price',
						'offersV2.listings.availability',
						'offersV2.listings.dealDetails',
						'offersV2.listings.merchantInfo',
						'offersV2.listings.condition',
						'images.primary.large',
					],
				}),
			});

			if (!response.ok) {
				throw new Error(
					`Amazon GetItems request failed: ${response.status} ${response.statusText}`,
				);
			}

			const parsed = AmazonGetItemsResponseSchema.parse(await response.json());
			return parsed.itemsResult?.items ?? [];
		});
	}

	private updateProducts(
		withAsin: ProductWithAsin[],
		itemsByAsin: Record<string, AmazonItem>,
	): Product[] {
		const updated: Product[] = [];

		for (const { product, asin } of withAsin) {
			const listing = itemsByAsin[asin]?.offersV2?.listings?.find(
				(candidate) => candidate.isBuyBoxWinner === true,
			);
			const money = listing?.price?.money;

			if (!money) {
				continue;
			}

			updated.push(
				this.applyUpdate(product, {
					price: money.amount,
					currency: money.currency,
				}),
			);
		}
		console.log(`AmazonDataRetrieved for ${updated.length} products`);

		return updated;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
