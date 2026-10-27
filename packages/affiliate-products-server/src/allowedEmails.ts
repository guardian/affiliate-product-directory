/**
 * The people who may use the tool, by the email address they log in with, in lower case.
 * Anyone else who logs in is told they don't have permission.
 */
const allowedEmails = new Set([
	'solomon.owen-williams@guardian.co.uk',
	'andrew.howe-ely@guardian.co.uk',
	'peran.osborn@guardian.co.uk',
	'elliott.cooper@guardian.co.uk',
	'yannis.karlis@guardian.co.uk',
	'rob.phillips@guardian.co.uk',
	'paul.brown@guardian.co.uk',
	'tom.allin@guardian.co.uk',
	'ella.jinadu@guardian.co.uk',
	'jessie.willms@guardian.co.uk',
	'nick.mokey@guardian.co.uk',
]);

/** Whether a user may use the tool. Case is ignored, as it is in email addresses. */
export const isAllowedEmail = (email: string) =>
	allowedEmails.has(email.trim().toLowerCase());
