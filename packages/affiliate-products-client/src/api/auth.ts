import { AuthResponseSchema } from '@common/tool-models';

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
