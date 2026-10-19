# affiliate-products-client

A single page React app (Vite) for browsing the affiliate product directory.

It is served, along with its API, by [affiliate-products-server](../affiliate-products-server), an Express app on a Lambda behind API Gateway. It is currently only deployed to CODE, at https://affiliate-products.code.dev-gutools.co.uk.

## Authentication

Every request, for the page or the API, must carry a valid Panda cookie, as for Composer and other editorial tools. Users without one are sent to login.gutools.co.uk (login.code.dev-gutools.co.uk in CODE), except for API requests, which get a 401. The server checks the cookie against the public key in the `pan-domain-auth-settings` bucket, and reads users' permissions from the permissions service's `permissions-cache` bucket using [@guardian/permissions-client](https://github.com/guardian/permissions). `/api/auth` returns the logged-in user and their permissions.

## Article list

`/api/articles?page=N&section=S` returns a page of 25 articles, newest first. `section` is a CAPI section ID, `thefilter` or `thefilter-us`; leave it out for both.

The page keeps the same two values in its own URL, so the address bar always links to what's on screen and can be shared, for example `/?page=2&section=thefilter-us`. Defaults are left out: `/` is the first page of both sections.

Each article comes with its product links: its product buttons and the links on its product cards, read from CAPI's body blocks, as the directory does. Each has its URL, its label and, when the label has a £ or $ price, that price as the base price. Prices are read the same way dotcom-rendering reads them for live prices. Expanding a row lists them.

Each product link also carries the directory's latest price for its URL: `currency`, `price`, `updatedAt` and `updatedBy` (the price provider that set it). They are missing if the directory doesn't have the URL as an active product, or has it but hasn't priced it yet. On every request the server looks up the page's product URLs in the stage's pricing table, with strongly consistent reads, so the tool always shows the table as it is, including a change made just before. Nothing is cached between requests. If the table can't be read, `/api/articles` fails.

### PROD data

In CODE, the sidebar's Data filter switches the list to PROD's articles and prices, adding `prod=true` to the page's URL and to `/api/articles`. The server then does the same as above, against PROD CAPI (with the PROD `capi-key` SSM parameter, as `PROD_CAPI_KEY`), PROD's Composer, and PROD's pricing table. The tool's role can only `BatchGetItem` from PROD's table, and explicitly denies everything else on it, so it can never write to it. PROD's tool only shows its own data, so the client hides the Data filter on `*.gutools.co.uk`.

Composer links need CAPI's `internalComposerCode` field, which CAPI only returns to internal-tier keys. With a developer-tier key they show as unavailable.

## Running locally

From the repository root:

```
npm install
CAPI_KEY=<a CODE CAPI key> npm run affiliate-products-dev
```

The home page lists articles from CODE CAPI, so the server needs a CODE CAPI key. Deployed, it uses the stage's key from the existing `capi-key` SSM parameter. To try the Data filter, also set `PROD_CAPI_KEY` to a PROD CAPI key.

This starts the server on port 3040 and the client's Vite dev server on port 5173; Ctrl+C stops both. Go to http://localhost:5173 for hot reloading. Vite proxies `/api` to the server.

Locally, every request is treated as coming from a fake user with a fake permission, because the Panda cookie is only sent to `*.dev-gutools.co.uk` and never to localhost.

The directory's prices need AWS credentials for the frontend account: get them from Janus and set `AWS_PROFILE` to their profile, on the command line or in `packages/affiliate-products-server/.env`. Without them the articles can't be listed.

To run it the way it's deployed, with the server serving the built app, run `npm -w affiliate-products-client run build`, start the server (with `CAPI_KEY` set), and go to http://localhost:3040.

## Deployment

The server's build copies this app's `build/` into its Lambda zip, `affiliate-products-tool.zip`. CI uploads that to the `frontend::affiliate-product-directory` Riff-Raff project, which deploys the `affiliate-products-tool` Lambda, API Gateway and domain defined in [packages/cdk/lib/tool.ts](../cdk/lib/tool.ts).
