import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		outDir: 'build',
	},
	plugins: [react({ jsxImportSource: '@emotion/react' })],
	resolve: {
		// Resolves @common/*, which the root tsconfig.json maps to packages/common/src.
		tsconfigPaths: true,
	},
	server: {
		host: '0.0.0.0',
		allowedHosts: ['affiliate-products.local.dev-gutools.co.uk'],
		ws: { path: '/vite-hmr' },
		// Run `npm -w affiliate-products-server start` alongside this for the API.
		proxy: { '/api': 'http://localhost:3040' },
	},
});
