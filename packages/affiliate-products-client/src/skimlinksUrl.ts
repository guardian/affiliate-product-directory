const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The Skimlinks Hub's report on a live article's earnings, from the day before it was
 * published up to today, as the Skimlinks Report bookmarklet opens it.
 */
export const skimlinksUrl = (
	webUrl: string,
	webPublicationDate: string | undefined,
) => {
	// The bookmarklet takes the date from the published time's date part, in UTC.
	const published = new Date(
		webPublicationDate?.slice(0, 10) ?? isoDay(new Date()),
	);
	const dayBefore = new Date(published);
	dayBefore.setDate(published.getDate() - 1);
	const params = new URLSearchParams({
		device: '',
		domain: 'null',
		startDate: isoDay(dayBefore),
		endDate: isoDay(new Date()),
		ampReport: 'all',
		skimlinksApps: 'null',
		country: '',
		paymentType: '',
		saasFee: '',
		previousStartDate: '',
		previousEndDate: '',
		showPeriodOnPeriod: 'false',
		periodFilter: 'period',
		advertiserId: 'null',
		advertiserName: '',
		// Skimlinks matches the page without its protocol or www.
		pageUrl: webUrl.replace(/^https?:\/\/(www\.)?/, ''),
	});
	return `https://hub.skimlinks.com/report/by_date?${params.toString()}`;
};
