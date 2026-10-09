# affiliate-products-client

A single page React app (Vite) for browsing the affiliate product directory.

It is served, along with its API, by [affiliate-products-server](../affiliate-products-server), an Express app on a Lambda behind API Gateway. It is currently only deployed to CODE, at https://affiliate-products.code.dev-gutools.co.uk.

## Authentication

Every request, for the page or the API, must carry a valid Panda cookie, as for Composer and other editorial tools. Users without one are sent to login.gutools.co.uk (login.code.dev-gutools.co.uk in CODE), except for API requests, which get a 401. The server checks the cookie against the public key in the `pan-domain-auth-settings` bucket, and reads users' permissions from the permissions service's `permissions-cache` bucket using [@guardian/permissions-client](https://github.com/guardian/permissions). `/api/auth` returns the logged-in user and their permissions.

## Running locally

From the repository root:

```
npm install
npm run affiliate-products-dev
```

This starts the server on port 3040 and the client's Vite dev server on port 5173; Ctrl+C stops both. Go to http://localhost:5173 for hot reloading. Vite proxies `/api` to the server.

Locally, every request is treated as coming from a fake user with a fake permission, because the Panda cookie is only sent to `*.dev-gutools.co.uk` and never to localhost.

To run it the way it's deployed, with the server serving the built app, run `npm -w affiliate-products-client run build`, start the server, and go to http://localhost:3040.

## Deployment

The server's build copies this app's `build/` into its Lambda zip, `affiliate-products-tool.zip`. CI uploads that to the `frontend::affiliate-product-directory` Riff-Raff project, which deploys the `affiliate-products-tool` Lambda, API Gateway and domain defined in [packages/cdk/lib/tool.ts](../cdk/lib/tool.ts).
