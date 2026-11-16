import { jest } from '@jest/globals';
import { isAllowedEmail } from './allowedEmails';
import type { Auth } from './types';

// An auth whose permissions service grants every user the given permissions.
const authWithPermissions = (permissions: string[]) => {
	const listPermissions = jest.fn(() => Promise.resolve(permissions));
	const auth: Auth = {
		authenticate: () => Promise.resolve(undefined),
		hasAccess: () => Promise.resolve(false),
		listPermissions,
		loginUrl: 'https://login.example.com/login',
	};
	return { auth, listPermissions };
};

describe('isAllowedEmail', () => {
	it('allows a listed email address without checking permissions', async () => {
		const { auth, listPermissions } = authWithPermissions([]);

		await expect(
			isAllowedEmail({ email: 'solomon.owen-williams@guardian.co.uk', auth }),
		).resolves.toBe(true);
		expect(listPermissions).not.toHaveBeenCalled();
	});

	it.each([
		'Solomon.Owen-Williams@guardian.co.uk',
		' solomon.owen-williams@guardian.co.uk ',
	])('allows %p, ignoring case and surrounding spaces', async (email) => {
		const { auth } = authWithPermissions([]);

		await expect(isAllowedEmail({ email, auth })).resolves.toBe(true);
	});

	it('refuses an email address that is not listed and has no permissions', async () => {
		const { auth } = authWithPermissions([]);

		await expect(
			isAllowedEmail({ email: 'someone.else@guardian.co.uk', auth }),
		).resolves.toBe(false);
	});

	it('allows an email address that is not listed but has the access permission', async () => {
		const { auth, listPermissions } = authWithPermissions([
			'affiliate_products_access',
		]);

		await expect(
			isAllowedEmail({ email: 'someone.else@guardian.co.uk', auth }),
		).resolves.toBe(true);
		expect(listPermissions).toHaveBeenCalledWith('someone.else@guardian.co.uk');
	});

	it('refuses an email address that is not listed and only has other permissions', async () => {
		const { auth } = authWithPermissions(['some_permission']);

		await expect(
			isAllowedEmail({ email: 'someone.else@guardian.co.uk', auth }),
		).resolves.toBe(false);
	});
});
