import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'build',
	},
	plugins: [react({ jsxImportSource: '@emotion/react' })],
	server: {
		// Run `npm -w affiliate-products-server start` alongside this for the API.
		proxy: { '/api': 'http://localhost:3040' },
	},
});
