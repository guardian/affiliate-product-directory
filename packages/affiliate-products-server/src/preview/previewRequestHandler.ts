import type { Product } from '@common/models';
import type { ProductsUpdater } from '@price-update/ProductsUpdater';
import { PreviewRequestSchema } from './requestSchema';

type HandlerResult =
	| { ok: true; products: Array<Product | Record<string, string>> }
	| { ok: false; status: 400; error: string };

export async function handlePreviewRequest(
	request: unknown,
	productsUpdater: ProductsUpdater,
): Promise<HandlerResult> {
	const parsedRequest = PreviewRequestSchema.safeParse(request);

	if (!parsedRequest.success) {
		return { ok: false, status: 400, error: parsedRequest.error.message };
	}

	const { products } = parsedRequest.data;

	products.forEach((p) => {
		console.log(`Fetching preview price for ${p.productMerchantUrl}`);
	});

	const productsWithPrices = await productsUpdater.getPreviewPrices(products);

	const priceByProductKey = new Map(
		productsWithPrices.map((product) => [product.productMerchantUrl, product]),
	);

	return {
		ok: true,
		products: products.map(
			(product) =>
				priceByProductKey.get(product.productMerchantUrl) ?? {
					...product,
					message: 'No live price available',
				},
		),
	};
}
