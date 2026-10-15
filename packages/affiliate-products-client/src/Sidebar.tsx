import { SectionSchema } from '@common/tool-models';
import type { Section } from '@common/tool-models';
import { css } from '@emotion/react';
import { SvgChevronDownSingleXsmall } from '@guardian/source/react-components';
import { useId, useState } from 'react';
import { sections } from './sections';
import { sidebarWidth, toolPalette, topToolbarHeight } from './style';

const sidebarStyles = css`
	position: sticky;
	top: ${topToolbarHeight}px;
	flex: 0 0 ${sidebarWidth}px;
	height: calc(100vh - ${topToolbarHeight}px);
	overflow-y: auto;
	background-color: ${toolPalette.grey100};
	border-right: 1px solid ${toolPalette.grey400};
`;

const buttonReset = css`
	border: none;
	border-radius: 0;
	font: inherit;
	color: ${toolPalette.text};
	cursor: pointer;
	text-align: left;
`;

const headerStyles = css`
	display: flex;
	height: 28px;
	border-top: 1px solid #fff;
	background-color: ${toolPalette.grey200};

	&:hover {
		background-color: #bbbbbb;
	}
`;

const headingStyles = (open: boolean) => css`
	${buttonReset};
	display: flex;
	flex: 1 1 auto;
	align-items: center;
	gap: 5px;
	padding: 0 0 0 5px;
	background: none;
	font-size: 11px;
	font-weight: bold;
	text-transform: uppercase;

	svg {
		width: 13px;
		fill: currentColor;
		transform: rotate(${open ? 0 : -90}deg);
		transition: transform 0.25s ease-in-out;
	}
`;

const filterStyles = (selected: boolean) => css`
	${buttonReset};
	display: block;
	width: 100%;
	font-size: 13px;
	background-color: ${selected ? toolPalette.bluegrey : toolPalette.grey100};
	border-left: 3px solid ${selected ? toolPalette.highlightBlue : 'transparent'};

	&:hover {
		background-color: ${selected ? toolPalette.bluegrey : '#d0d0d0'};
	}
`;

// The "All" option, which sits in the section's header.
const defaultFilterStyles = (selected: boolean) => css`
	${filterStyles(selected)};
	width: auto;
	padding: 6px 12px;
	border-left: 1px solid #fff;
	background-color: ${selected ? toolPalette.bluegrey : 'transparent'};
	box-shadow: ${selected ? `inset 3px 0 ${toolPalette.highlightBlue}` : 'none'};
`;

const listStyles = css`
	margin: 0;
	padding: 0;
	list-style: none;
`;

const listItemStyles = css`
	border-bottom: 1px solid ${toolPalette.grey200};
`;

const optionStyles = (selected: boolean) => css`
	${filterStyles(selected)};
	padding: 7px 0 7px 20px;
`;

const SectionFilter = ({
	section,
	onChange,
}: {
	section?: Section;
	onChange: (section?: Section) => void;
}) => {
	const [open, setOpen] = useState(true);
	const listId = useId();

	return (
		<section>
			<div css={headerStyles}>
				<button
					type="button"
					css={headingStyles(open)}
					aria-expanded={open}
					aria-controls={listId}
					onClick={() => setOpen(!open)}
				>
					<SvgChevronDownSingleXsmall />
					Section
				</button>
				<button
					type="button"
					css={defaultFilterStyles(section === undefined)}
					aria-pressed={section === undefined}
					onClick={() => onChange(undefined)}
				>
					All
				</button>
			</div>
			{open && (
				<ul id={listId} css={listStyles}>
					{SectionSchema.options.map((option) => (
						<li key={option} css={listItemStyles}>
							<button
								type="button"
								css={optionStyles(section === option)}
								aria-pressed={section === option}
								onClick={() => onChange(option)}
							>
								{sections[option].name}
							</button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

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
				<button
					type="button"
					css={headingStyles(open)}
					aria-expanded={open}
					aria-controls={listId}
					onClick={() => setOpen(!open)}
				>
					<SvgChevronDownSingleXsmall />
					Data
				</button>
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

export const Sidebar = ({
	section,
	onSectionChange,
	prod,
	onProdChange,
}: {
	section?: Section;
	onSectionChange: (section?: Section) => void;
	prod: boolean;
	onProdChange: (prod: boolean) => void;
}) => (
	<nav css={sidebarStyles} aria-label="Filters">
		<SectionFilter section={section} onChange={onSectionChange} />
		{!isProd && <DataFilter prod={prod} onChange={onProdChange} />}
	</nav>
);
