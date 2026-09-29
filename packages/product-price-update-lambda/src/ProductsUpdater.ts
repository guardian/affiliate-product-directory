import type { DynamoService } from '@common/database-service';
import type { Product } from '@common/models';
import { AmazonPriceProvider } from '@price-update/price-providers/amazon/AmazonPriceProvider';
import type { PriceProvider } from '@price-update/price-providers/PriceProvider';
import { ShopifyPriceProvider } from '@price-update/price-providers/shopify/ShopifyPriceProvider';
import { SkimlinksPriceProvider } from '@price-update/price-providers/skimlinks/SkimlinksPriceProvider';
import { S3FileWriter } from '@price-update/S3FileWriter';

type Partner = 'amazon' | 'other';
type CategorisedProducts = Record<Partner, Product[]>;

export class ProductsUpdater {
	/** Providers for each category, in priority order. Products a provider can't price fall through to the next. */
	private providers: Record<Partner, PriceProvider[]> = {
		amazon: [new AmazonPriceProvider()],
		other: [new ShopifyPriceProvider(), new SkimlinksPriceProvider()],
	};
	private s3FileWriter = new S3FileWriter();

	constructor(private readonly dynamoService: DynamoService) {}

	/**
	 * This is the main entry point for updating the prices, it will get all products in the DB
	 *  and check affiliate partners for the latest prices, and lastly updated the DB
	 */
	public async refreshPrices() {
		const categorised = this.categoriseProducts(await this.getProductsFromDB());

		const [amazonUpdated, otherUpdated] = await Promise.all([
			this.refreshWithFallback(categorised.amazon, this.providers.amazon),
			this.refreshWithFallback(categorised.other, this.providers.other),
		]);

		const allProducts = [...amazonUpdated, ...otherUpdated];
		await this.dynamoService.updateProducts({
			items: allProducts,
		});
		await this.s3FileWriter.writeProductsToS3File(allProducts);
	}

	public async getProductsFromDB(): Promise<Product[]> {
		// only update products that are active
		return (await this.dynamoService.getAllProducts({})).filter(
			(v) => v.removed !== 'true',
		);
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

			const providerUpdated = await provider.refreshPrices(remaining);
			updated.push(...providerUpdated);

			const updatedSet = new Set(providerUpdated);
			remaining = remaining.filter((product) => !updatedSet.has(product));
		}

		return updated;
	}

	private categoriseProducts(products: Product[]): CategorisedProducts {
		const categorised: CategorisedProducts = { amazon: [], other: [] };
		const amazonHosts = new Set([
			'amazon.com',
			'www.amazon.com',
			'amazon.co.uk',
			'www.amazon.co.uk',
		]);

		products.forEach((product) => {
			try {
				const hostname = new URL(
					product.productMerchantUrl,
				).hostname.toLowerCase();
				const partner: Partner = amazonHosts.has(hostname) ? 'amazon' : 'other';
				categorised[partner].push(product);
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
