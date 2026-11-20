import { baseColors, semanticColors } from '@guardian/stand';
import { Avatar } from '@guardian/stand/Avatar';
import type { FaviconTheme } from '@guardian/stand/Favicon';
import {
	TopBar,
	TopBarContainerLeft,
	TopBarItem,
	TopBarToolName,
} from '@guardian/stand/TopBar';
import type { TopBarTheme } from '@guardian/stand/TopBar';
import type { ReactNode } from 'react';
import type { User } from '../../common/src/tool-models';

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
	userData,
	search,
}: {
	userData?: User;
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
		{userData && (
			<Avatar
				src={userData.avatarUrl}
				alt={`${userData.firstName} ${userData.lastName}`}
				initials={userData.firstName.charAt(0) + userData.lastName.charAt(0)}
			/>
		)}
	</TopBar>
);
