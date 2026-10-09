import { createApp } from './app';

const port = 3040;

createApp({ clientDir: '../affiliate-products-client/build' }).listen(
	port,
	() => {
		console.log(`Listening on http://localhost:${port}`);
	},
);
