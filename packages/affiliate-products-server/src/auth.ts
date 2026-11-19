import {
	guardianValidation,
	PanDomainAuthentication,
} from '@guardian/pan-domain-node';
import { init as initPermissions } from '@guardian/permissions-client';
import { hasAccessPermission } from './hasAccess';
import type { Auth } from './types';

const pandaDomains: Record<string, string> = {
	CODE: 'code.dev-gutools.co.uk',
	PROD: 'gutools.co.uk',
};

/**
 * Checks the Panda cookie set by login.gutools.co.uk (login.code.dev-gutools.co.uk in CODE)
 * against the public key in the pan-domain-auth-settings bucket, as gudocs2 does.
 */
export function createPandaAuth(stage: string): Auth {
	const pandaDomain = pandaDomains[stage];
	if (!pandaDomain) {
		throw new Error(`No Panda domain for stage ${stage}`);
	}

	// Fetched once, when the auth is created, and awaited by each request.
	const panda = PanDomainAuthentication.builder({
		cookieName: 'gutoolsAuth-assym',
		region: 'eu-west-1',
		bucket: 'pan-domain-auth-settings',
		keyFile: `${pandaDomain}.settings.public`,
		validateUser: guardianValidation,
	});
	// A failed fetch would otherwise be an unhandled rejection, which stops the Lambda's Node
	// process. It's still thrown to each request that awaits it.
	panda.catch(() => undefined);

	const { listUserPermissions } = initPermissions({ stage });

	return {
		authenticate: async (cookieHeader) => {
			const result = await (await panda).verify(cookieHeader);
			if (!result.success) {
				return undefined;
			}
			const { email, firstName, lastName, avatarUrl } = result.user;
			return { email, firstName, lastName, avatarUrl };
		},
		hasAccess: hasAccessPermission,
		listPermissions: listUserPermissions,
		loginUrl: `https://login.${pandaDomain}/login`,
	};
}
