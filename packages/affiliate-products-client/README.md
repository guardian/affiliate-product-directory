# affiliate-products-client

A single page React app (Vite) for browsing the affiliate product directory.

It is served, along with its API, by [affiliate-products-server](../affiliate-products-server), an Express app on a Lambda behind API Gateway. It is currently only deployed to CODE, at https://affiliate-products.code.dev-gutools.co.uk.

## Running locally

From the repository root:

```
npm install
npm run affiliate-products-dev
```

This starts the server on port 3040 and the client's Vite dev server on port 5173; Ctrl+C stops both. Go to http://localhost:5173 for hot reloading. Vite proxies `/api` to the server.

To run it the way it's deployed, with the server serving the built app, run `npm -w affiliate-products-client run build`, start the server, and go to http://localhost:3040.

## Deployment

The server's build copies this app's `build/` into its Lambda zip, `affiliate-products-tool.zip`. CI uploads that to the `frontend::affiliate-product-directory` Riff-Raff project, which deploys the `affiliate-products-tool` Lambda, API Gateway and domain defined in [packages/cdk/lib/tool.ts](../cdk/lib/tool.ts).
