import { isAllowedEmail } from './allowedEmails';

describe('isAllowedEmail', () => {
	it('allows a listed email address', () => {
		expect(isAllowedEmail('solomon.owen-williams@guardian.co.uk')).toBe(true);
	});

	it.each([
		'Solomon.Owen-Williams@guardian.co.uk',
		' solomon.owen-williams@guardian.co.uk ',
	])('allows %p, ignoring case and surrounding spaces', (email) => {
		expect(isAllowedEmail(email)).toBe(true);
	});

	it('refuses an email address that is not listed', () => {
		expect(isAllowedEmail('someone.else@guardian.co.uk')).toBe(false);
	});
});
