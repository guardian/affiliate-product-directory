/** A date as shown in the lists, from an ISO date string or a timestamp in milliseconds. */
export const formatDate = (date: string | number) =>
	new Date(date).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});

/** A date with its time, such as 27 Oct 2026, 14:35, for a hover title on a date. */
export const formatDateTime = (date: string | number) =>
	new Date(date).toLocaleString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
