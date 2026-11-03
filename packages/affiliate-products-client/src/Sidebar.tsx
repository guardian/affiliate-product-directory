import { SectionSchema } from '@common/tool-models';
import type { ArticleStatus, Section } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticColors, semanticTypography } from '@guardian/stand';
import { Icon } from '@guardian/stand/Icon';
import { Layout } from '@guardian/stand/Layout';
import {
	convertTypographyToEmotionStringStyle,
	from,
	until,
} from '@guardian/stand/utils';
import { useId, useState } from 'react';
import { sections } from './sections';

// Below md the sidebar sits above the list, rather than beside it.
const sidebarStyles = css`
	background-color: ${semanticColors.bg.raisedLevel1};

	${from.md} {
		border-right: 1px solid ${semanticColors.border.weak};
	}

	${until.md} {
		border-bottom: 1px solid ${semanticColors.border.weak};
	}
`;

const buttonReset = css`
	border: none;
	border-radius: 0;
	color: ${semanticColors.text.strong};
	cursor: pointer;
	text-align: left;
`;

const headerStyles = css`
	display: flex;
	min-height: 28px;
	border-top: 1px solid ${semanticColors.bg.base};
	background-color: ${semanticColors.bg.raisedLevel2};

	&:hover {
		background-color: ${semanticColors.bg.raisedLevel3};
	}
`;

const headingStyles = css`
	${buttonReset};
	${convertTypographyToEmotionStringStyle(semanticTypography.headingXs)};
	display: flex;
	flex: 1 1 auto;
	align-items: center;
	gap: 4px;
	padding: 0 0 0 4px;
	background: none;
	text-transform: uppercase;
`;

const chevronStyles = (open: boolean) => css`
	transform: rotate(${open ? 0 : -90}deg);
	transition: transform 0.25s ease-in-out;
`;

const filterStyles = (selected: boolean) => css`
	${buttonReset};
	${convertTypographyToEmotionStringStyle(semanticTypography.bodySm)};
	display: block;
	width: 100%;
	background-color: ${selected
		? semanticColors.fill.selectedWeaker
		: semanticColors.bg.raisedLevel1};
	border-left: 3px solid
		${selected ? semanticColors.border.selected : 'transparent'};

	&:hover {
		background-color: ${selected
			? semanticColors.fill.selectedHoverWeaker
			: semanticColors.bg.raisedLevel2};
	}
`;

// The "All" option, which sits in the section's header.
const defaultFilterStyles = (selected: boolean) => css`
	${filterStyles(selected)};
	width: auto;
	padding: 6px 12px;
	border-left: 1px solid ${semanticColors.bg.base};
	background-color: ${selected
		? semanticColors.fill.selectedWeaker
		: 'transparent'};
	box-shadow: ${selected
		? `inset 3px 0 ${semanticColors.border.selected}`
		: 'none'};
`;

const listStyles = css`
	margin: 0;
	padding: 0;
	list-style: none;
`;

const listItemStyles = css`
	border-bottom: 1px solid ${semanticColors.border.weaker};
`;

const optionStyles = (selected: boolean) => css`
	${filterStyles(selected)};
	padding: 7px 0 7px 20px;
`;

const FilterHeading = ({
	name,
	open,
	listId,
	onToggle,
}: {
	name: string;
	open: boolean;
	listId: string;
	onToggle: () => void;
}) => (
	<button
		type="button"
		css={headingStyles}
		aria-expanded={open}
		aria-controls={listId}
		onClick={onToggle}
	>
		<Icon
			symbol="keyboard_arrow_down"
			size="sm"
			cssOverrides={chevronStyles(open)}
		/>
		{name}
	</button>
);

/** A filter with an "All" option in its header, and an option for each of the values. */
const OptionFilter = <Value extends string>({
	name,
	options,
	selected,
	onChange,
}: {
	name: string;
	options: Array<{ value: Value; name: string }>;
	/** Undefined when "All" is selected. */
	selected?: Value;
	onChange: (value?: Value) => void;
}) => {
	const [open, setOpen] = useState(true);
	const listId = useId();

	return (
		<section>
			<div css={headerStyles}>
				<FilterHeading
					name={name}
					open={open}
					listId={listId}
					onToggle={() => setOpen(!open)}
				/>
				<button
					type="button"
					css={defaultFilterStyles(selected === undefined)}
					aria-pressed={selected === undefined}
					onClick={() => onChange(undefined)}
				>
					All
				</button>
			</div>
			{open && (
				<ul id={listId} css={listStyles}>
					{options.map((option) => (
						<li key={option.value} css={listItemStyles}>
							<button
								type="button"
								css={optionStyles(selected === option.value)}
								aria-pressed={selected === option.value}
								onClick={() => onChange(option.value)}
							>
								{option.name}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

const sectionOptions = SectionSchema.options.map((value) => ({
	value,
	name: sections[value].name,
}));

const statusOptions: Array<{ value: ArticleStatus; name: string }> = [
	{ value: 'draft', name: 'Drafts' },
	{ value: 'live', name: 'Published' },
];

// Only the articles with live pricing can be picked out, as CAPI can't search for those without.
const livePricingOptions = [{ value: 'on', name: 'Enabled' }];

// PROD's tool only ever shows PROD's data. The same build is served to every stage, so
// PROD is told apart by its domain: CODE's is code.dev-gutools.co.uk.
const isProd = window.location.hostname.endsWith('.gutools.co.uk');

// The stage's own data, which is always CODE where PROD's can be shown too.
const dataOptions = [
	{ prod: false, name: 'CODE' },
	{ prod: true, name: 'PROD' },
];

const DataFilter = ({
	prod,
	onChange,
}: {
	prod: boolean;
	onChange: (prod: boolean) => void;
}) => {
	const [open, setOpen] = useState(true);
	const listId = useId();

	return (
		<section>
			<div css={headerStyles}>
				<FilterHeading
					name="Data"
					open={open}
					listId={listId}
					onToggle={() => setOpen(!open)}
				/>
			</div>
			{open && (
				<ul id={listId} css={listStyles}>
					{dataOptions.map((option) => (
						<li key={option.name} css={listItemStyles}>
							<button
								type="button"
								css={optionStyles(prod === option.prod)}
								aria-pressed={prod === option.prod}
								onClick={() => onChange(option.prod)}
							>
								{option.name}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

/** The list's filters, in the layout's sidebar. */
export const Sidebar = ({
	section,
	onSectionChange,
	status,
	onStatusChange,
	livePricing,
	onLivePricingChange,
	prod,
	onProdChange,
}: {
	section?: Section;
	onSectionChange: (section?: Section) => void;
	status?: ArticleStatus;
	onStatusChange: (status?: ArticleStatus) => void;
	livePricing: boolean;
	onLivePricingChange: (livePricing: boolean) => void;
	prod: boolean;
	onProdChange: (prod: boolean) => void;
}) => (
	<Layout.Sidebar
		as="nav"
		aria-label="Filters"
		layoutSmBreakpoint="above-grid"
		cssOverrides={sidebarStyles}
	>
		<OptionFilter
			name="Section"
			options={sectionOptions}
			selected={section}
			onChange={onSectionChange}
		/>
		<OptionFilter
			name="Status"
			options={statusOptions}
			selected={status}
			onChange={onStatusChange}
		/>
		<OptionFilter
			name="Live pricing"
			options={livePricingOptions}
			selected={livePricing ? 'on' : undefined}
			onChange={(value) => onLivePricingChange(value === 'on')}
		/>
		{!isProd && <DataFilter prod={prod} onChange={onProdChange} />}
	</Layout.Sidebar>
);
