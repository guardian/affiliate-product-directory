import { getConfig } from '@common/config';
import { appName } from '@common/constants';
import type { Product } from '@common/models';
import { getParametersFromParameterStore } from '@common/parameterStore';

/**
 * Base class for an affiliate partner we fetch prices from (Skimlinks, Amazon, ...)
 */
export abstract class PriceProvider {
	/**
	 * Whether this provider is switched on, read from `/<stage>/<stack>/<app>/<name>/enabled`.
	 * Deliberately not cached across instances, so a new instance always picks up the current value.
	 */
	private readonly enabled: Promise<boolean>;

	/** @param name used as `updatedBy` on refreshed products and in the parameter store path, e.g. `'skimlinks'`. */
	constructor(protected readonly name: string) {
		this.enabled = this.fetchEnabled();
	}

	/**
	 * Refresh prices on these products, splitting them into those that were updated and those that weren't.
	 * If the provider is disabled, every product is returned as not updated.
	 */
	public async refreshPrices(products: Product[]): Promise<PriceRefreshResult> {
		if (!(await this.enabled)) {
			console.log(
				`${this.name} price provider is disabled, skipping ${products.length} products`,
			);
			return { updated: [], notUpdated: products };
		}

		const updated = await this.fetchPrices(products);
		const updatedIds = new Set(updated.map((p) => p.productMerchantUrl));
		return {
			updated,
			notUpdated: products.filter((p) => !updatedIds.has(p.productMerchantUrl)),
		};
	}

	/** Provider-specific price refresh, only called when the provider is enabled. */
	protected abstract fetchPrices(products: Product[]): Promise<Product[]>;

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

	/** Anything other than `'true'`, including a missing parameter, counts as disabled. */
	private async fetchEnabled(): Promise<boolean> {
		const { stage, stack } = getConfig();
		const enabledKey = `/${stage}/${stack}/${appName}/${this.name}/enabled`;

		try {
			const parameters = await getParametersFromParameterStore([enabledKey]);
			return parameters[enabledKey] === 'true';
		} catch (error) {
			console.log(`Failed to read ${enabledKey}`, error);
			return false;
		}
	}
}

/** `updated` were priced by this provider; `notUpdated` should be offered to the next one. */
export interface PriceRefreshResult {
	updated: Product[];
	notUpdated: Product[];
}

/** Fields a provider is allowed to refresh (identity fields are immutable, timestamp/author are auto-stamped). */
type ProductUpdate = Partial<
	Pick<Product, 'removed' | 'removedAt' | 'price' | 'currency'>
>;
