import { createApp } from './app';
import type { Auth } from './auth';

const port = 3040;

// The Panda cookie is only sent to *.dev-gutools.co.uk, never to localhost, so every
// request is treated as coming from this user. The Lambda entry point (index.ts) never uses this.
const localAuth: Auth = {
	authenticate: () =>
		Promise.resolve({
			email: 'local.user@guardian.co.uk',
			firstName: 'Local',
			lastName: 'User',
		}),
	listPermissions: () => Promise.resolve(['local_permission']),
	loginUrl: '',
};

createApp({
	clientDir: '../affiliate-products-client/build',
	auth: localAuth,
}).listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
