import { css } from '@emotion/react';
import { baseColors, semanticSpacing } from '@guardian/stand';

// The tool's colour, from Stand's orange scale. It marks the tool in its top bar and icon
// (in TopToolbar) and an open article: the bar down its left edge, its bottom border and
// the bar of actions on it.
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

// Articles with live pricing are marked in Stand's green: a tinted row, and a "Live pricing"
// badge by the products' heading once it's opened.
export const livePricingAccent = {
	tint: baseColors.green[900],
	tintHover: baseColors.green[800],
};

// Stand's AlertBanner is one line high, with its text centred. Where its text wraps, in a
// narrow column or a dialog, the banner grows to fit it, with the text and icon from the
// top left.
export const wrappingBannerTheme = {
	shared: {
		height: 'auto',
		padding: { top: semanticSpacing.stackXs, bottom: semanticSpacing.stackXs },
		content: { justifyContent: 'flex-start', alignItems: 'flex-start' },
	},
};

/** Read by screen readers, but not shown. */
export const visuallyHidden = css`
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
`;
