import type { Tag } from '@guardian/content-api-models/v1/tag';

const FILTER_US_SERIES_TAG_ID = 'thefilter-us/series/thefilter-us';
const FILTER_UK_SERIES_TAG_ID = 'thefilter/series/the-filter';

const FILTER_TAGs = [FILTER_UK_SERIES_TAG_ID, FILTER_US_SERIES_TAG_ID];

export const isFilterArticleByTags = (tags: Tag[]) =>
	tags.some((tag) => FILTER_TAGs.includes(tag.id));

type Region = 'GB' | 'US';

export const getRegionFromTags = (tags: Tag[]): Region | undefined => {
	const filterTag = tags.find((tag) => FILTER_TAGs.includes(tag.id));

	if (filterTag === undefined) {
		// This means we have a non-Filter article
		return undefined;
	}

	switch (filterTag.id) {
		case FILTER_UK_SERIES_TAG_ID:
			return 'GB';
		case FILTER_US_SERIES_TAG_ID:
			return 'US';
		default:
			// This means we have a non-Filter article
			return undefined;
	}
};
