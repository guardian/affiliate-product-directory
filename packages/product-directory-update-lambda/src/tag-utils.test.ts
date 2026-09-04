import { filterTagsUK, filterTagsUS, nonFilterTags } from './tag-fixtures';
import { getRegionFromTags, isFilterArticleByTags } from './tag-utils';

describe('isFilterArticleByTags', () => {
	it('Returns true for Filter UK article', () => {
		const result = isFilterArticleByTags(filterTagsUK);
		expect(result).toEqual(true);
	});

	it('Returns true for Filter US article', () => {
		const result = isFilterArticleByTags(filterTagsUS);
		expect(result).toEqual(true);
	});

	it('Returns false for non-Filter article', () => {
		const result = isFilterArticleByTags(nonFilterTags);
		expect(result).toEqual(false);
	});
});

describe('getRegionFromTags', () => {
	it('Returns GB for Filter UK article', () => {
		const result = getRegionFromTags(filterTagsUK);
		expect(result).toEqual('GB');
	});

	it('Returns US for Filter US article', () => {
		const result = getRegionFromTags(filterTagsUS);
		expect(result).toEqual('US');
	});

	it('Returns undefined for non-Filter article', () => {
		const result = getRegionFromTags(nonFilterTags);
		expect(result).toBeUndefined();
	});
});
