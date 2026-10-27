# affiliate-products-client

A single page React app (Vite) for browsing the affiliate product directory.

It is served, along with its API, by [affiliate-products-server](../affiliate-products-server), an Express app on a Lambda behind API Gateway. It is currently only deployed to CODE, at https://affiliate-products.code.dev-gutools.co.uk.

## Authentication

Every request, for the page or the API, must carry a valid Panda cookie, as for Composer and other editorial tools. Users without one are sent to login.gutools.co.uk (login.code.dev-gutools.co.uk in CODE), except for API requests, which get a 401. The server checks the cookie against the public key in the `pan-domain-auth-settings` bucket. Only the people whose email addresses are listed in [allowedEmails.ts](../affiliate-products-server/src/allowedEmails.ts) can use the tool: anyone else who logs in gets a 403 saying they don't have permission. To give someone access, add their address to that list. The server also reads users' permissions from the permissions service's `permissions-cache` bucket using [@guardian/permissions-client](https://github.com/guardian/permissions). `/api/auth` returns the logged-in user and their permissions.

## Article list

`/api/articles?page=N&section=S` returns a page of 25 articles, newest first. `section` is a CAPI section ID, `thefilter` or `thefilter-us`; leave it out for both.

The page keeps the same two values in its own URL, so the address bar always links to what's on screen and can be shared, for example `/?page=2&section=thefilter-us`. Defaults are left out: `/` is the first page of both sections.

Each article comes with its products, read from CAPI's body blocks, each with its links to the retailers that sell it, as the POC lists them:

- A product card is one product, with its links and the product buttons inside it.
- Product buttons outside a card are grouped by run: buttons in a row, with nothing but empty text between them, are one product at several retailers. The run is named by the text just before it, if that ends with a bold paragraph, a heading or an "at a glance" list item, without a label such as "Best for travel:".
- Links back to the Filter, its fronts or its articles, such as an "Explore the Filter" button, aren't products, so they're left out.
- Products that share a URL are one product, listed where it first appears, as an article often lists a product in an "at a glance" list, then in full with more retailers. A product card's name is preferred.

Each link has its URL, its label, its retailer (from a product card, or the end of a button's label, as in "£27 at Cult Beauty") and, when the label has a £ or $ price, that price as the base price. Prices are read the same way dotcom-rendering reads them for live prices. Expanding a row shows the article's details, its products with their links, and the retailers it links to.

Each product link also carries the directory's latest price for its URL: `currency`, `price`, `updatedAt` and `updatedBy` (the price provider that set it). They are missing if the directory doesn't have the URL as an active product, or has it but hasn't priced it yet. On every request the server looks up the page's product URLs in the stage's pricing table, with strongly consistent reads, so the tool always shows the table as it is, including a change made just before. Nothing is cached between requests. If the table can't be read, `/api/articles` fails.

## Link counts

Expanding a row also shows how many links the article has, counted as the Affiliate Link Counter bookmarklet (December 2024) counts them, so the numbers can be compared with ones it gave. `/api/link-counts?url=<the article's web URL>` fetches the article as it's rendered on the site, as Skimlinks only wraps links then, and counts every link on the page, repeats included:

- `amazon`: links to amazon.co.uk or amazon.com, including through Skimlinks.
- `skimlinks`: other links through skimresources.
- `other`: links to web pages on any other host than the page's. Like the bookmarklet, this includes the Guardian's own links on other hosts, such as jobs.theguardian.com in the footer.

The affiliate share is the Amazon and Skimlinks links as a share of all three. The panel's Download CSV button gets `/api/link-counts.csv?url=…`, the bookmarklet's CSV of the page's external links: each once, Amazon links first, then Skimlinks links, then the rest, leaving out the hosts the bookmarklet leaves out of its CSV, with the same columns. The server only fetches pages on www.theguardian.com and CODE's site, which serves its articles from m.code.dev-theguardian.com. On CODE, links to www.theguardian.com count as the page's own, as they would on PROD.

### PROD data

In CODE, the sidebar's Data filter switches the list to PROD's articles and prices, adding `prod=true` to the page's URL and to `/api/articles`. The server then does the same as above, against PROD CAPI (with the PROD `capi-key` SSM parameter, as `PROD_CAPI_KEY`), PROD's Composer, and PROD's pricing table. The tool's role can only `BatchGetItem` from PROD's table, and explicitly denies everything else on it, so it can never write to it. PROD's tool only shows its own data, so the client hides the Data filter on `*.gutools.co.uk`.

Composer links need CAPI's `internalComposerCode` field, which CAPI only returns to internal-tier keys. With a developer-tier key they show as unavailable.

## Composer embed

`/embed` is a panel of the products in a draft, with their prices in the directory, for Composer to show in an iframe beside the article. The tool can't read drafts itself, so Composer sends the article with `postMessage`:

1. The embed posts `{ source: 'affiliate-products', type: 'ready', version: 1 }` to Composer when it loads.
2. Composer replies with `{ source: 'composer', type: 'content', version: 1, composerId, section, elements }`, where `elements` are the body's elements as Composer holds them. It sends it again after every `ready`, and about a second after each edit.
3. The embed posts the message to `/api/embed/products`, which turns the elements into CAPI's shape (`composerElements.ts`), finds the products as the article list does, and adds their prices. Links the directory doesn't have yet are marked `notInDirectory`, as they won't have a live price until the article is published and priced.
4. The embed posts `{ source: 'affiliate-products', type: 'height', version: 1, height }` whenever its height changes, so Composer can size the iframe.

The messages are defined in [common/src/embed.ts](../common/src/embed.ts). The embed only accepts messages from the stage's Composer, and the server only lets that Composer frame `/embed`, with a `frame-ancestors` policy. An editor who isn't logged in gets a link to log in in a new tab, as Panda's login page can't be shown in a frame.

The shape of Composer's elements is a guess until Composer sends a real one: see `@mocks/ComposerContentFixture`.

To try it locally, run the dev servers as below and go to http://localhost:5173/embed-harness.html, which stands in for Composer. Edit the message there to change what the embed is sent.

## Running locally

From the repository root:

```
npm install
CAPI_KEY=<a CODE CAPI key> npm run affiliate-products-dev
```

The home page lists articles from CODE CAPI, so the server needs a CODE CAPI key. Deployed, it uses the stage's key from the existing `capi-key` SSM parameter. To try the Data filter, also set `PROD_CAPI_KEY` to a PROD CAPI key.

This starts the server on port 3040 (set `PORT` to change it) and the client's Vite dev server on port 5173; Ctrl+C stops both. The server restarts itself when its code changes. Go to http://localhost:5173 for hot reloading. Vite proxies `/api` to the server.

Locally, every request is treated as coming from a fake user with a fake permission, because the Panda cookie is only sent to `*.dev-gutools.co.uk` and never to localhost.

The directory's prices need AWS credentials for the frontend account: get them from Janus and set `AWS_PROFILE` to their profile, on the command line or in `packages/affiliate-products-server/.env`. Without them the articles can't be listed.

To run it the way it's deployed, with the server serving the built app, run `npm -w affiliate-products-client run build`, start the server (with `CAPI_KEY` set), and go to http://localhost:3040.

## Deployment

The server's build copies this app's `build/` into its Lambda zip, `affiliate-products-tool.zip`. CI uploads that to the `frontend::affiliate-product-directory` Riff-Raff project, which deploys the `affiliate-products-tool` Lambda, API Gateway and domain defined in [packages/cdk/lib/tool.ts](../cdk/lib/tool.ts).
