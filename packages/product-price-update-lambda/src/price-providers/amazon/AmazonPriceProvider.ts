import type { Product } from '../../models';
import { PriceProvider } from '../PriceProvider';

export class AmazonPriceProvider extends PriceProvider {
	protected readonly name = 'amazon';

	public refreshPrices(products: Product[]): Promise<Product[]> {
		// ToDo: call the Amazon PA-API (per-marketplace, batched, via this.withRetry)
		console.log(`Fetching Amazon prices for ${products.length} products`);
		return Promise.resolve(products);
	}
}
