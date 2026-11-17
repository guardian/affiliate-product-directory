import type { Auth } from './types';

/** Whether a user may use the tool: whether they have its permission in the permissions service. */
export const hasAccessPermission = async ({
	email,
	auth,
}: {
	email: string;
	auth: Auth;
}) => {
	return (await auth.listPermissions(email)).includes(
		'affiliate_products_access',
	);
};
