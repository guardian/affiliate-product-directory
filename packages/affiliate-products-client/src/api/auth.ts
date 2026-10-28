import { AuthResponseSchema } from '@common/tool-models';
import { z } from 'zod';

/** Fetches the logged-in user's name, or undefined if it can't be fetched. */
export const fetchUserName = async (): Promise<string | undefined> => {
	const response = await fetch('/api/auth');
	if (!response.ok) {
		return undefined;
	}

	const auth = AuthResponseSchema.safeParse(await response.json());
	if (!auth.success) {
		console.error('Unexpected response from /api/auth', auth.error);
		return undefined;
	}
	return `${auth.data.user.firstName} ${auth.data.user.lastName}`;
};

/** Whether PROD's prices may be set by hand from this stage, which is switched on and off. */
export const fetchCanEditProdPrices = async (): Promise<boolean> => {
	const response = await fetch('/api/switches');
	if (!response.ok) {
		return false;
	}
	const switches = z
		.object({ editProdPrices: z.boolean() })
		.safeParse(await response.json());
	return switches.success && switches.data.editProdPrices;
};
