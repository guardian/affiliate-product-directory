import type { DynamoService } from '../../../common/src/database-service';
import {
	ManualOverrideDeleteRequestSchema,
	ManualOverrideRequestSchema,
} from './requestSchemas';

type HandlerResult =
	| { ok: true }
	| { ok: false; status: 400 | 404 | 409; error: string };

export async function handleOverrideRequest(
	request: unknown,
	dynamoService: DynamoService,
): Promise<HandlerResult> {
	const parsedRequest = ManualOverrideRequestSchema.safeParse(request);

	if (!parsedRequest.success) {
		return { ok: false, status: 400, error: parsedRequest.error.message };
	}
	const { currency, price, expiryDate, productMerchantUrl, region } =
		parsedRequest.data;

	// A price kept until a moment already past would be replaced by the next price update.
	if (expiryDate && expiryDate.getTime() <= Date.now()) {
		return { ok: false, status: 400, error: 'The expiry date has passed' };
	}

	const storedProduct = await dynamoService.getProductPrice(productMerchantUrl);
	// A draft's product is added to the directory with its price. When the article is
	// published, the directory keeps the product as it is, so the price stays.
	const productDatabaseEntry =
		storedProduct ?? (region && { productMerchantUrl, region });

	if (!productDatabaseEntry) {
		return { ok: false, status: 404, error: 'Product not found' };
	}

	console.log(
		`Setting manual override for product ${productMerchantUrl} with ${currency}${price} ${expiryDate ? `with expiry date ${expiryDate.toDateString()}` : ''}`,
	);
	await dynamoService.updateProducts({
		items: [
			{
				...productDatabaseEntry,
				price,
				currency,
				expiresAt: expiryDate?.getTime(),
				updatedBy: 'manualOverride',
				updatedAt: Date.now(),
			},
		],
	});
	return { ok: true };
}

export async function handleOverrideDeleteRequest(
	request: unknown,
	dynamoService: DynamoService,
): Promise<HandlerResult> {
	const parsedRequest = ManualOverrideDeleteRequestSchema.safeParse(request);

	if (!parsedRequest.success) {
		return { ok: false, status: 400, error: parsedRequest.error.message };
	}

	const { productMerchantUrl } = parsedRequest.data;
	const productDatabaseEntry =
		await dynamoService.getProductPrice(productMerchantUrl);

	if (productDatabaseEntry === undefined) {
		return { ok: false, status: 404, error: 'Product not found' };
	}

	if (productDatabaseEntry.updatedBy !== 'manualOverride') {
		const errorMessage = `Tried to remove manualOverride of product ${productMerchantUrl} but it was last updated by something else`;
		console.error(errorMessage);
		return {
			ok: false,
			status: 404,
			error: errorMessage,
		};
	}

	console.log(`Removing manual override for product ${productMerchantUrl}`);
	await dynamoService.updateProducts({
		items: [
			{
				...productDatabaseEntry,
				expiresAt: undefined,
				price: undefined,
				currency: undefined,
				updatedBy: 'manualOverrideRemoved',
				updatedAt: Date.now(),
			},
		],
	});
	return { ok: true };
}
