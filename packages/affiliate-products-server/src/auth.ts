import {
	guardianValidation,
	PanDomainAuthentication,
} from '@guardian/pan-domain-node';
import { init as initPermissions } from '@guardian/permissions-client';
import { isAllowedEmail } from './allowedEmails';
import type { Auth } from './types';

const pandaDomains: Record<string, string> = {
	CODE: 'code.dev-gutools.co.uk',
	PROD: 'gutools.co.uk',
};

/**
 * Checks the Panda cookie set by login.gutools.co.uk (login.code.dev-gutools.co.uk in CODE)
 * against the public key in the pan-domain-auth-settings bucket, as gudocs2 does.
 */
export async function createPandaAuth(stage: string): Promise<Auth> {
	const pandaDomain = pandaDomains[stage];
	if (!pandaDomain) {
		throw new Error(`No Panda domain for stage ${stage}`);
	}

	const panda = await PanDomainAuthentication.builder({
		cookieName: 'gutoolsAuth-assym',
		region: 'eu-west-1',
		bucket: 'pan-domain-auth-settings',
		keyFile: `${pandaDomain}.settings.public`,
		validateUser: guardianValidation,
	});

	const { listUserPermissions } = initPermissions({ stage });

	return {
		authenticate: async (cookieHeader) => {
			const result = await panda.verify(cookieHeader);
			if (!result.success) {
				return undefined;
			}
			const { email, firstName, lastName, avatarUrl } = result.user;
			return { email, firstName, lastName, avatarUrl };
		},
		hasAccess: isAllowedEmail,
		listPermissions: listUserPermissions,
		loginUrl: `https://login.${pandaDomain}/login`,
	};
}
