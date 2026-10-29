import { SectionSchema } from '@common/tool-models';
import type { Section } from '@common/tool-models';

interface SectionDisplay {
	name: string;
	colour: string;
}

// Stand's badges have no blue or red, so these are the Guardian's brand blue and news red.
const brandBlue = '#052962';
const newsRed = '#C70000';

/** How each section is shown in the sidebar filter and on article rows. */
export const sections: Record<Section, SectionDisplay> = {
	thefilter: { name: 'UK', colour: brandBlue },
	'thefilter-us': { name: 'US', colour: newsRed },
};

/** How to show an article's section, falling back to its ID if it isn't one the tool lists. */
export const describeSection = (sectionId: string): SectionDisplay => {
	const section = SectionSchema.safeParse(sectionId);
	return section.success
		? sections[section.data]
		: { name: sectionId, colour: brandBlue };
};
