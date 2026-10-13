import type { DynamoService } from '../../../common/src/database-service';
import {
	ManualOverrideDeleteRequestSchema,
	ManualOverrideRequestSchema,
} from './requestSchemas';

export async function handleOverrideRequest(
	request: unknown,
	dynamoService: DynamoService,
) {
	// ToDo: handle failed parsing
	const { currency, price, expiryDate, productMerchantUrl } =
		ManualOverrideRequestSchema.parse(request);

	const productDatabaseEntry =
		await dynamoService.getProductPrice(productMerchantUrl);

	if (productDatabaseEntry === undefined) {
		return;
	}

	if (
		currency != productDatabaseEntry.currency &&
		productDatabaseEntry.currency !== ''
	) {
		console.error(
			`Manual override currency ${currency} does not match stored currency of ${productDatabaseEntry.currency}`,
		);
		return;
	}

	console.log(
		`Setting manual override for product ${productMerchantUrl} with ${currency}${price} ${expiryDate ? `with expiry date ${expiryDate.toDateString()}` : ''}`,
	);
	await dynamoService.updateProducts({
		items: [
			{
				...productDatabaseEntry,
				price,
				expiresAt: expiryDate?.getTime(),
				updatedBy: 'manualOverride',
				updatedAt: Date.now(),
			},
		],
	});
}

export async function handleOverrideDeleteRequest(
	request: unknown,
	dynamoService: DynamoService,
) {
	const { productMerchantUrl } =
		ManualOverrideDeleteRequestSchema.parse(request);

	const productDatabaseEntry =
		await dynamoService.getProductPrice(productMerchantUrl);

	if (productDatabaseEntry?.updatedBy !== 'manualOverride') {
		// This wasn't actually overriden, what should we do with it?
		return;
	}

	console.log(`Removing manual override for product ${productMerchantUrl}`);
	await dynamoService.updateProducts({
		items: [
			{
				...productDatabaseEntry,
				expiresAt: undefined,
				updatedBy: 'manualOverrideRemoved',
				updatedAt: Date.now(),
			},
		],
	});
}
