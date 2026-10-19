import { productButtonLabel } from '@common/productButtonLabel';
import type { ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticShadow,
	semanticSpacing,
	semanticTypography,
} from '@guardian/stand';
import { convertTypographyToEmotionStringStyle } from '@guardian/stand/utils';
import {
	cloneElement,
	type ReactElement,
	useEffect,
	useId,
	useRef,
	useState,
} from 'react';
import { Tooltip, TooltipTriggerStateContext } from 'react-aria-components';

const tooltipStyles = css`
	max-width: 24rem;
	padding: ${semanticSpacing.stackSm};
	border: 1px solid ${semanticColors.border.weak};
	border-radius: ${semanticRadius.cornerMd};
	background-color: ${semanticColors.bg.base};
	box-shadow: ${semanticShadow.raised};
`;

// The tooltip takes no id, so its content is wrapped in one the link is described by.
const contentStyles = css`
	display: grid;
	gap: ${semanticSpacing.stackXs};
`;

const captionStyles = css`
	${convertTypographyToEmotionStringStyle(semanticTypography.bodyXs)};
	margin: 0;
	color: ${semanticColors.text.weak};
`;

// The site's product button: Source's primary LinkButton in the lifestyle palette, as
// dotcom-rendering's ProductLinkButton draws it.
const siteButtonStyles = css`
	justify-self: start;
	/* Not flex, which would drop the space between a struck-through price and the new one. */
	display: inline-block;
	padding: 0.75rem 1.25rem;
	border-radius: 2.75rem;
	background-color: #7d0068;
	color: #ffffff;
	font-family:
		'GuardianTextSans', 'Guardian Text Sans Web', 'Helvetica Neue', Helvetica,
		Arial, sans-serif;
	font-size: 1.0625rem;
	font-weight: 700;
	line-height: 1.15;

	s {
		font-weight: normal;
	}
`;

/** Why the label is shown the way it is, in a few words under the preview. */
const explain = (link: ProductLink, struck: boolean, changed: boolean) => {
	if (link.price === undefined) {
		return 'No current price';
	}
	if (struck) {
		return 'Price dropped';
	}
	if (changed) {
		return 'Price updated';
	}
	return 'Shown as written';
};

/**
 * Shows, when the link is hovered or focused, how the site draws its button with the
 * directory's latest price, including the old price struck through after a big drop.
 */
export const ButtonPreview = ({
	link,
	children,
}: {
	link: ProductLink;
	/** The link to hover or focus, which the preview describes while it's open. */
	children: ReactElement<{ 'aria-describedby'?: string }>;
}) => {
	const { struckThrough, text } = productButtonLabel(link.label, link);
	const changed = struckThrough !== undefined || text !== link.label;

	// Stand's Link doesn't take react-aria's tooltip trigger props, so the tooltip is opened
	// from a wrapper around it instead: on hover, after a moment, and on keyboard focus.
	const triggerRef = useRef<HTMLSpanElement>(null);
	const tooltipId = useId();
	const [isOpen, setOpen] = useState(false);
	const timer = useRef<number>(undefined);
	const openSoon = () => {
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setOpen(true), 300);
	};
	const close = () => {
		window.clearTimeout(timer.current);
		setOpen(false);
	};
	useEffect(() => () => window.clearTimeout(timer.current), []);

	return (
		<>
			<span
				ref={triggerRef}
				onMouseEnter={openSoon}
				onMouseLeave={close}
				onFocus={(event) => {
					if (event.target.matches(':focus-visible')) {
						setOpen(true);
					}
				}}
				onBlur={close}
			>
				{cloneElement(children, {
					'aria-describedby': isOpen ? tooltipId : undefined,
				})}
			</span>
			{/* What a TooltipTrigger would give the tooltip, which reads its state from this. */}
			<TooltipTriggerStateContext.Provider
				value={{
					isOpen,
					open: () => setOpen(true),
					close,
					shouldSkipAnimation: false,
				}}
			>
				<Tooltip
					triggerRef={triggerRef}
					isOpen={isOpen}
					onOpenChange={setOpen}
					placement="top start"
					offset={6}
					css={tooltipStyles}
				>
					<div id={tooltipId} css={contentStyles}>
						<p css={captionStyles}>On the site</p>
						<span
							css={siteButtonStyles}
							aria-label={
								struckThrough
									? `Was ${struckThrough}, now ${text.trim()}`
									: text
							}
						>
							{struckThrough && <s>{struckThrough}</s>}
							{text}
						</span>
						<p css={captionStyles}>
							{explain(link, struckThrough !== undefined, changed)}
						</p>
					</div>
				</Tooltip>
			</TooltipTriggerStateContext.Provider>
		</>
	);
};
