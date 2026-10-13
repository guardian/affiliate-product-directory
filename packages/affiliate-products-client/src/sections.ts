import { SectionSchema } from '@common/tool-models';
import type { Section } from '@common/tool-models';
import { palette } from '@guardian/source/foundations';

interface SectionDisplay {
	name: string;
	colour: string;
}

/** How each section is shown in the sidebar filter and on article rows. */
export const sections: Record<Section, SectionDisplay> = {
	thefilter: { name: 'The Filter UK', colour: palette.brand[400] },
	'thefilter-us': { name: 'The Filter US', colour: palette.news[400] },
};

/** How to show an article's section, falling back to its ID if it isn't one the tool lists. */
export const describeSection = (sectionId: string): SectionDisplay => {
	const section = SectionSchema.safeParse(sectionId);
	return section.success
		? sections[section.data]
		: { name: sectionId, colour: palette.brand[400] };
};
