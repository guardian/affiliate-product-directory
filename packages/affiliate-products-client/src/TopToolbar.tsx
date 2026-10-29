import { baseColors, semanticColors } from '@guardian/stand';
import type { FaviconTheme } from '@guardian/stand/Favicon';
import {
	TopBar,
	TopBarContainerLeft,
	TopBarContainerRight,
	TopBarItem,
	TopBarToolName,
} from '@guardian/stand/TopBar';
import type { TopBarTheme } from '@guardian/stand/TopBar';
import { Typography } from '@guardian/stand/Typography';
import type { ReactNode } from 'react';

const topBarTheme: TopBarTheme = {
	backgroundColor: baseColors.orange[200],
	toolName: {
		color: semanticColors.text.strongerInverse,
		hoverLink: {
			color: semanticColors.text.strongerInverse,
			backgroundColor: baseColors.orange[100],
			pressed: { backgroundColor: baseColors.orange[100] },
		},
	},
};

const faviconTheme: FaviconTheme = {
	color: { background: baseColors.orange[400] },
};

export const TopToolbar = ({
	userName,
	search,
}: {
	userName?: string;
	/** The search for an article, beside the tool's name. */
	search: ReactNode;
}) => (
	// The search stays in the bar at every width, rather than folding into a menu.
	<TopBar theme={topBarTheme} collapseBelow={{ containerLeft: 'sm' }}>
		<TopBarToolName
			name="The Filter"
			favicon={{ letter: 'F', theme: faviconTheme }}
		/>
		<TopBarContainerLeft>
			<TopBarItem theme={{ border: 'none' }}>{search}</TopBarItem>
		</TopBarContainerLeft>
		{userName && (
			<TopBarContainerRight>
				<TopBarItem>
					<Typography
						variant="bodySm"
						theme={{ color: semanticColors.text.strongerInverse }}
					>
						{userName}
					</Typography>
				</TopBarItem>
			</TopBarContainerRight>
		)}
	</TopBar>
);
