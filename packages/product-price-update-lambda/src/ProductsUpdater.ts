import type { DynamoService } from '@common/database-service';
import type { Product } from '@common/models';
import { AmazonPriceProvider } from '@price-update/price-providers/amazon/AmazonPriceProvider';
import type { PriceProvider } from '@price-update/price-providers/PriceProvider';
import { ShopifyPriceProvider } from '@price-update/price-providers/shopify/ShopifyPriceProvider';
import { SkimlinksPriceProvider } from '@price-update/price-providers/skimlinks/SkimlinksPriceProvider';

type Partner = 'amazon' | 'other';
type CategorisedProducts = Record<Partner, Product[]>;
const IN_FLIGHT_WRITE_MARGIN_MS = 30_000;

export class ProductsUpdater {
	/** Providers for each category, in priority order. Products a provider can't price fall through to the next. */
	private providers: Record<Partner, PriceProvider[]> = {
		amazon: [new AmazonPriceProvider()],
		other: [new ShopifyPriceProvider(), new SkimlinksPriceProvider()],
	};

	constructor(private readonly dynamoService: DynamoService) {}

	/**
	 * This is the main entry point for updating the prices, it will get all products in the DB
	 *  and check affiliate partners for the latest prices, and lastly updated the DB.
	 *  Writing to the DB is what updates the prices CSV: see product-prices-csv-lambda.
	 */
	public async refreshPrices() {
		const updatedAtCutoff = Date.now() - IN_FLIGHT_WRITE_MARGIN_MS;
		const categorised = this.categoriseProducts(await this.getProductsFromDB());

		const [amazonUpdated, otherUpdated] = await Promise.all([
			this.refreshWithFallback(categorised.amazon, this.providers.amazon),
			this.refreshWithFallback(categorised.other, this.providers.other),
		]);

		const allProducts = [...amazonUpdated, ...otherUpdated];
		const { skipped } = await this.dynamoService.updateProducts({
			items: allProducts,
			updatedAtCutoff,
		});
		if (skipped.length > 0) {
			console.log(
				`Left ${skipped.length} product(s) as they were, as they were changed or removed during this run: ${skipped.join(', ')}`,
			);
		}
	}

	public async getProductsFromDB(): Promise<Product[]> {
		// only update products that are active
		return (await this.dynamoService.getAllProducts({})).filter(
			(v) => v.removed !== 'true',
		);
	}

	public async getPreviewPrice(product: Product): Promise<Product> {
		const partner = this.getPartner(product);
		const providers =
			partner === 'amazon' ? this.providers.amazon : this.providers.other;
		const [updated] = await this.refreshWithFallback([product], providers);

		if (updated === undefined) {
			throw new Error(
				`Could not fetch preview price for ${product.productMerchantUrl}`,
			);
		}

		return updated;
	}

	/** Tries each provider in turn, passing on only the products the previous ones couldn't price. */
	private async refreshWithFallback(
		products: Product[],
		providers: PriceProvider[],
	): Promise<Product[]> {
		const updated: Product[] = [];
		let remaining = products;

		for (const provider of providers) {
			if (remaining.length === 0) {
				break;
			}

			const result = await provider.refreshPrices(remaining);
			updated.push(...result.updated);
			remaining = result.notUpdated;
		}

		return updated;
	}

	private shouldSkipManualPrice(product: Product): boolean {
		return (
			product.updatedBy === 'manualOverride' &&
			(product.expiresAt === undefined || product.expiresAt > Date.now())
		);
	}

	private getPartner(product: Product): Partner {
		const amazonHosts = new Set([
			'amazon.com',
			'www.amazon.com',
			'amazon.co.uk',
			'www.amazon.co.uk',
		]);
		const hostname = new URL(product.productMerchantUrl).hostname.toLowerCase();
		return amazonHosts.has(hostname) ? 'amazon' : 'other';
	}

	private categoriseProducts(products: Product[]): CategorisedProducts {
		const categorised: CategorisedProducts = {
			amazon: [],
			other: [],
		};

		products.forEach((product) => {
			try {
				if (this.shouldSkipManualPrice(product)) {
					console.log(
						`Skipping ${product.productMerchantUrl} as it has manual override ${product.expiresAt ? `until ${product.expiresAt}` : ''}`,
					);
				} else {
					const partner = this.getPartner(product);
					categorised[partner].push(product);
				}
			} catch {
				console.log(
					`Received invalid URL ${product.productMerchantUrl} - could not determine best affiliate partner`,
				);
				categorised['other'].push(product);
			}
		});

		return categorised;
	}
}
