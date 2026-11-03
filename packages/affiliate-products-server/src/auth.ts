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
export function createPandaAuth(stage: string): Auth {
	const pandaDomain = pandaDomains[stage];
	if (!pandaDomain) {
		throw new Error(`No Panda domain for stage ${stage}`);
	}

	const panda = new PanDomainAuthentication(
		'gutoolsAuth-assym',
		'eu-west-1',
		'pan-domain-auth-settings',
		`${pandaDomain}.settings.public`,
		guardianValidation,
	);

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
