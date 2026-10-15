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
	const { currency, price, expiryDate, productMerchantUrl } =
		parsedRequest.data;

	const productDatabaseEntry =
		await dynamoService.getProductPrice(productMerchantUrl);

	if (productDatabaseEntry === undefined) {
		return { ok: false, status: 404, error: 'Product not found' };
	}

	if (
		currency != productDatabaseEntry.currency &&
		productDatabaseEntry.currency !== ''
	) {
		const errorMessage = `Manual override currency ${currency} does not match stored currency of ${productDatabaseEntry.currency}`;
		console.error(errorMessage);
		return {
			ok: false,
			status: 400,
			error: errorMessage,
		};
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
