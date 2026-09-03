import type { Tag } from '@guardian/content-api-models/v1/tag';

const FILTER_US_TRACKING_TAG_ID =
	'tracking/commissioningdesk/filter-us' as const;
const FILTER_UK_TRACKING_TAG_ID = 'tracking/commissioningdesk/the-filter';

const FILTER_TAGs = [FILTER_UK_TRACKING_TAG_ID, FILTER_US_TRACKING_TAG_ID];

export const isFilterArticleByTags = (tags: Tag[]) =>
	tags.some((tag) => FILTER_TAGs.includes(tag.id));

export const getRegionFromTags = (tags: Tag[]): string | undefined => {
	const filterTag = tags.find((tag) => FILTER_TAGs.includes(tag.id));

	if (filterTag === undefined) {
		// This means we have a non-Filter article
		return undefined;
	}

	switch (filterTag.id) {
		case FILTER_UK_TRACKING_TAG_ID:
			return 'UK';
		case FILTER_US_TRACKING_TAG_ID:
			return 'US';
		default:
			// This means we have a non-Filter article
			return undefined;
	}
};
