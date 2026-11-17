import { jest } from '@jest/globals';
import { buildAuth } from '@mocks/AuthMock';
import { hasAccessPermission } from './hasAccess';

// An auth whose permissions service grants every user the given permissions.
const authWithPermissions = (permissions: string[]) => {
	const listPermissions = jest.fn(() => Promise.resolve(permissions));
	return { auth: buildAuth({ listPermissions }), listPermissions };
};

describe('hasAccessPermission', () => {
	it('allows an email address with the access permission', async () => {
		const { auth, listPermissions } = authWithPermissions([
			'affiliate_products_access',
		]);

		await expect(
			hasAccessPermission({ email: 'someone@guardian.co.uk', auth }),
		).resolves.toBe(true);
		expect(listPermissions).toHaveBeenCalledWith('someone@guardian.co.uk');
	});

	it('refuses an email address with no permissions', async () => {
		const { auth } = authWithPermissions([]);

		await expect(
			hasAccessPermission({ email: 'someone@guardian.co.uk', auth }),
		).resolves.toBe(false);
	});

	it('refuses an email address with only other permissions', async () => {
		const { auth } = authWithPermissions(['some_permission']);

		await expect(
			hasAccessPermission({ email: 'someone@guardian.co.uk', auth }),
		).resolves.toBe(false);
	});
});
