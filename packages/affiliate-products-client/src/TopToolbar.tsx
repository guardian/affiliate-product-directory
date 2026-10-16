import {
	TopBar,
	TopBarContainerRight,
	TopBarItem,
	TopBarToolName,
} from '@guardian/stand/TopBar';
import { Typography } from '@guardian/stand/Typography';

export const TopToolbar = ({ userName }: { userName?: string }) => (
	<TopBar>
		<TopBarToolName name="Affiliate" favicon={{ letter: 'A' }} />
		{userName && (
			<TopBarContainerRight>
				<TopBarItem>
					<Typography variant="bodySm">{userName}</Typography>
				</TopBarItem>
			</TopBarContainerRight>
		)}
	</TopBar>
);
