import type { DynamoService } from '../../../common/src/database-service';
import { ManualOverrideRequestSchema } from './request';

export async function handleRequest(
	request: unknown,
	dynamoService: DynamoService,
) {
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
