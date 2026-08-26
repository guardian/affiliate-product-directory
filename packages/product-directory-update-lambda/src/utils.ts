import type { Tag } from '@guardian/content-api-models/v1/tag';

const FILTER_TAGs = ['The Filter UK (series tag)', 'The Filter US'];

export const isFilterArticleByTags = (tags: Tag[]) =>
	tags.some((tag) => FILTER_TAGs.includes(tag.internalName ?? ''));
