import type {
	ComposerContentMessage,
	EmbedProductsResponse,
} from '@common/embed';
import { EmbedProductsResponseSchema } from '@common/embed';

export type EmbedProductsState =
	| { status: 'loaded'; response: EmbedProductsResponse }
	| { status: 'unauthenticated' }
	| { status: 'forbidden' }
	| { status: 'error' };

/** The products in the draft Composer has sent, with their prices in the directory. */
export const fetchEmbedProducts = async (
	content: ComposerContentMessage,
	signal: AbortSignal,
): Promise<EmbedProductsState> => {
	const response = await fetch('/api/embed/products', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(content),
		signal,
	});
	if (response.status === 401) {
		return { status: 'unauthenticated' };
	}
	if (response.status === 403) {
		return { status: 'forbidden' };
	}
	if (!response.ok) {
		return { status: 'error' };
	}

	const body = EmbedProductsResponseSchema.safeParse(await response.json());
	if (!body.success) {
		console.error('Unexpected response from /api/embed/products', body.error);
		return { status: 'error' };
	}
	return { status: 'loaded', response: body.data };
};
