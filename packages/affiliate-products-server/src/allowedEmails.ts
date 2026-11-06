/**
 * The people who may use the tool, by the email address they log in with, in lower case.
 * Anyone else who logs in is told they don't have permission.
 */
const allowedEmails = new Set([
	// The Ftiler team
	'solomon.owen-williams@guardian.co.uk',
	'andrew.howe-ely@guardian.co.uk',
	'peran.osborn@guardian.co.uk',
	'elliott.cooper@guardian.co.uk',
	'yannis.karlis@guardian.co.uk',
	'rob.phillips@guardian.co.uk',
	'paul.brown@guardian.co.uk',
	'tom.allin@guardian.co.uk',
	// UK Editorial team
	'ella.jinadu@guardian.co.uk',
	'monica.horridge@guardian.co.uk',
	'millie.fender@guardian.co.uk',
	'emily.goddard@guardian.co.uk',
	'lily.smith@guardian.co.uk',
	'fiona.mckellar@guardian.co.uk',
	'robert.hull@guardian.co.uk',
	'hannah.booth@guardian.co.uk',
	// US Editorial team
	'jessie.willms@guardian.co.uk',
	'nick.mokey@guardian.co.uk',
	'karen.yuan@guardian.co.uk',
	'lauren.gould@guardian.co.uk',
	'jeffrey.vancamp@guardian.co.uk', // contractor
	'megan.reynolds.contractor@guardian.co.uk', // contractor
	'david.strauss@guardian.co.uk',
	'alastair.gee@guardian.co.uk',
	'tracy.allison@guardian.co.uk',
]);

/** Whether a user may use the tool. Case is ignored, as it is in email addresses. */
export const isAllowedEmail = (email: string) =>
	allowedEmails.has(email.trim().toLowerCase());
