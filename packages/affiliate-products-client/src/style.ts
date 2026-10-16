import { baseColors } from '@guardian/stand';

// The tool's colour, from Stand's orange scale. Like Dispatch, it marks the tool in its top
// bar and icon (in TopToolbar) and an open article: the bar down its left edge, its bottom
// border and the bar of actions on it.
export const accent = {
	strong: baseColors.orange[400],
	tint: baseColors.orange[900],
	tintBorder: baseColors.orange[800],
};

// Drafts are marked in Stand's yellow, as Composer marks content that isn't live: a tinted
// row with a stripe down its left edge, and a "Draft" badge by the headline.
export const draftAccent = {
	stripe: baseColors.yellow[400],
	tint: baseColors.yellow[900],
	tintHover: baseColors.yellow[800],
};
