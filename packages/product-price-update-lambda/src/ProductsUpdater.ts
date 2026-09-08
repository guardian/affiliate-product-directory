import type { DynamoService } from '@common/database-service';
import type { Product } from '@common/models';
import { AmazonPriceProvider } from '@price-update/price-providers/amazon/AmazonPriceProvider';
import { SkimlinksPriceProvider } from '@price-update/price-providers/skimlinks/SkimlinksPriceProvider';

type Partner = 'amazon' | 'skimlinks';
type CategorisedProducts = Record<Partner, Product[]>;

export class ProductsUpdater {
	private amazon = new AmazonPriceProvider();
	private skimlinks = new SkimlinksPriceProvider();

	constructor(private readonly dynamoService: DynamoService) {}

	/**
	 * This is the main entry point for updating the prices, it will get all products in the DB
	 *  and check affiliate partners for the latest prices, and lastly updated the DB
	 */
	public async refreshPrices() {
		const categorised = this.categoriseProducts(await this.getProductsFromDB());

		const [amazonUpdated, skimlinksUpdated] = await Promise.all([
			this.amazon.refreshPrices(categorised.amazon),
			this.skimlinks.refreshPrices(categorised.skimlinks),
		]);

		await this.dynamoService.batchUpdateProducts({
			items: [...amazonUpdated, ...skimlinksUpdated],
		});
	}

	public async getProductsFromDB(): Promise<Product[]> {
		return await this.dynamoService.getAllProducts({});
	}

	private categoriseProducts(products: Product[]): CategorisedProducts {
		const categorised: CategorisedProducts = { amazon: [], skimlinks: [] };
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
				const partner: Partner = amazonHosts.has(hostname)
					? 'amazon'
					: 'skimlinks';
				categorised[partner].push(product);
			} catch {
				console.log(
					`Received invalid URL ${product.productMerchantUrl} - could not determine best affiliate partner`,
				);
				categorised['skimlinks'].push(product);
			}
		});

		return categorised;
	}
}
