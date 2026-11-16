import { jest } from '@jest/globals';
import type { User } from '@common/tool-models';
import type { Auth } from '../affiliate-products-server/src/types';

export const mockUser: User = {
	email: 'test.user@guardian.co.uk',
	firstName: 'Test',
	lastName: 'User',
};

/** An Auth for tests: mockUser is logged in, has access and has no permissions, unless overridden. */
export function buildAuth(overrides: Partial<Auth> = {}): Auth {
	return {
		authenticate: jest.fn<Auth['authenticate']>(() =>
			Promise.resolve(mockUser),
		),
		hasAccess: jest.fn<Auth['hasAccess']>(() => Promise.resolve(true)),
		listPermissions: jest.fn<Auth['listPermissions']>(() =>
			Promise.resolve([]),
		),
		loginUrl: 'https://login.example.com/login',
		...overrides,
	};
}
