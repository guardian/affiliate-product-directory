import { articlePath } from '@common/articlePath';
import { css } from '@emotion/react';
import {
	semanticColors,
	semanticRadius,
	semanticShadow,
	semanticSpacing,
} from '@guardian/stand';
import { InlineMessage } from '@guardian/stand/InlineMessage';
import { SearchInput } from '@guardian/stand/SearchInput';
import { useState } from 'react';

// In the top bar, so a message about what was typed drops down below it.
const searchStyles = css`
	position: relative;
	width: min(32rem, 45vw);
`;

// The label is only for screen readers, so the field doesn't need the space above it that
// Stand leaves for one.
const inputTheme = { shared: { marginTop: '0' } };

const errorStyles = css`
	position: absolute;
	top: calc(100% + ${semanticSpacing.stackXxs});
	left: 0;
	right: 0;
	z-index: 1;
	padding: ${semanticSpacing.stackXs} ${semanticSpacing.stackSm};
	border-radius: ${semanticRadius.cornerSm};
	background-color: ${semanticColors.bg.base};
	box-shadow: ${semanticShadow.raised};
`;

/**
 * Finds an article by its URL or path, pasted or typed. The search is kept in the page's
 * URL. Give it the path as its key, so that it starts again with what's being searched for
 * after Back and Forward.
 */
export const ArticleSearch = ({
	path,
	onSearch,
}: {
	path: string | undefined;
	onSearch: (path: string | undefined) => void;
}) => {
	const [value, setValue] = useState(path ?? '');
	const [error, setError] = useState<string>();

	const search = (input: string) => {
		if (input.trim() === '') {
			onSearch(undefined);
			return;
		}
		const found = articlePath(input);
		if (!found) {
			setError(
				'Paste an article’s URL, such as https://www.theguardian.com/thefilter/…, or its path.',
			);
			return;
		}
		setError(undefined);
		onSearch(found);
	};

	return (
		<div css={searchStyles} role="search">
			<SearchInput
				aria-label="Find an article by its URL or path"
				placeholder="Add an article URL or path"
				value={value}
				onChange={(next) => {
					setValue(next);
					setError(undefined);
				}}
				onSubmit={search}
				onClear={() => onSearch(undefined)}
				isInvalid={error !== undefined}
				size="sm"
				fluid
				theme={inputTheme}
			/>
			{error && (
				<div css={errorStyles}>
					<InlineMessage level="error">{error}</InlineMessage>
				</div>
			)}
		</div>
	);
};
