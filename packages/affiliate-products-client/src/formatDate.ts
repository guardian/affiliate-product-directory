/** A date as shown in the lists, from an ISO date string or a timestamp in milliseconds. */
export const formatDate = (date: string | number) =>
	new Date(date).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});
