/**
 * Splits an array into chunks of a given size.
 */
export function chunk<T>(items: T[], size: number): T[][] {
	if (items.length === 0) {
		return [];
	}
	return [items.slice(0, size), ...chunk(items.slice(size), size)];
}
