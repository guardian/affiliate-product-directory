// Stand's typography is set in Open Sans, and its icons come from the Material Symbols font.
import '@guardian/stand/fonts/OpenSans.css';
import '@guardian/stand/fonts/MaterialSymbolsOutlined.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Embed } from './Embed';

const root = document.getElementById('root');

if (!root) {
	throw new Error('Root element not found');
}

createRoot(root).render(
	<StrictMode>
		{/* Composer's panel, which it shows in an iframe. */}
		{window.location.pathname === '/embed' ? <Embed /> : <App />}
	</StrictMode>,
);
