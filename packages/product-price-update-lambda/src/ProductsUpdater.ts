import { batchUpdateItems, getAllItems } from '../../common/src/dynamoDB';
import type { Product } from './models';
import { AmazonPriceProvider } from './price-providers/amazon/AmazonPriceProvider';
import { SkimlinksPriceProvider } from './price-providers/skimlinks/SkimlinksPriceProvider';

type Partner = 'amazon' | 'skimlinks';
type CategorisedProducts = Record<Partner, Product[]>;

export class ProductsUpdater {
	private productTableName: string;
	private amazon = new AmazonPriceProvider();
	private skimlinks = new SkimlinksPriceProvider();

	constructor({ productTableName }: { productTableName: string }) {
		this.productTableName = productTableName;
	}

	/**
	 * This is the main entry point for updating the prices, it will get all products in the DB
	 *  and check affiliate partners for the latest prices, and lastly updated the DB
	 */
	public async updatePrices() {
		const categorised = this.categoriseProducts(await this.getProductsFromDB());

		const [amazonUpdated, skimlinksUpdated] = await Promise.all([
			this.amazon.fetchPrices(categorised.amazon),
			this.skimlinks.fetchPrices(categorised.skimlinks),
		]);

		await batchUpdateItems({
			items: [...amazonUpdated, ...skimlinksUpdated],
			tableName: this.productTableName,
		});
	}

	public async getProductsFromDB(): Promise<Product[]> {
		return await getAllItems<Product>({ tableName: this.productTableName });
	}

	private categoriseProducts(products: Product[]): CategorisedProducts {
		const categorised: CategorisedProducts = { amazon: [], skimlinks: [] };

		products.forEach((product) => {
			const hostname = new URL(product.url).hostname;
			const partner: Partner =
				hostname.includes('amazon.com') || hostname.includes('amazon.co.uk')
					? 'amazon'
					: 'skimlinks';
			categorised[partner].push(product);
		});

		return categorised;
	}
}
