import type { Product } from '../models';

/**
 * Base class for an affiliate partner we fetch prices from (Skimlinks, Amazon, ...)
 */
export abstract class PriceProvider {
	/** Used as `updatedBy` on refreshed products, e.g. `'skimlinks'`. */
	protected abstract readonly name: string;

	/** Refresh prices for these products. */
	public abstract fetchPrices(products: Product[]): Promise<Product[]>;

	protected async withRetry<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 3000));
			return operation();
		}
	}

	/** Applies field changes to a product and records who refreshed it and when. */
	protected applyUpdate(product: Product, changes: ProductUpdate): Product {
		Object.assign(product, changes);
		product.updatedAt = Date.now();
		product.updatedBy = this.name;
		return product;
	}

	/** Splits an array into consecutive chunks of at most `size`. */
	protected chunk<T>(items: T[], size: number): T[][] {
		const batches: T[][] = [];
		for (let i = 0; i < items.length; i += size) {
			batches.push(items.slice(i, i + size));
		}
		return batches;
	}
}

/** Fields a provider is allowed to refresh (identity fields are immutable, timestamp/author are auto-stamped). */
type ProductUpdate = Partial<
	Omit<Product, 'url' | 'createdAt' | 'region' | 'updatedAt' | 'updatedBy'>
>;
