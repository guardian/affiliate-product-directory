# product-price-update-lambda

This lambda is responsible for updating the list of products stored in the `ProductDirectoryPricingTable`. The lambda is written in Typescript.

## Architecture

The lambda is configured to be triggered by an Eventbridge rule that runs every day at a set time. This rule is defined as part of the `GuScheduledLambda` CDK construct.

The event that is fired from Eventbridge currently does not currently send a payload and the lambda will simply attempt to update all products within the Prices DB.

Once an event hits the lambda, the main orchestrator is the `ProductsUpdater.ts` class which categorises each product by which partner/method we should use to update their respective prices. This is mainly to take advantage of any batch offerings from our price providers.

### Processing updates

If a request for product prices is successful (2XX) but no data can be found, this will not throw an error and a log will be made to declare this information.

## Price providers

Each price provider extends the `PriceProvider` base class and is given products to process/update.

- **amazon** (`amazon.com`, `amazon.co.uk`) → Amazon
- **other** (everything else) → Shopify, then Skimlinks

Within a category the providers are tried in priority order, and any products a provider couldn't price fall through to the next one.  
For example, if Shopify does not have price data, we will try Skimlinks.

Credentials and config are stored in AWS SSM Parameter Store under `/<STAGE>/<STACK>/affiliate-product-directory/<provider>/...`.

### Enabling/disabling a provider

Each provider can be switched on or off without a deploy using this SSM parameter:

```
/<STAGE>/<STACK>/affiliate-product-directory/<provider>/enabled
```

where `<provider>` is `amazon`, `shopify` or `skimlinks`. The provider only runs when the value is `true`. A disabled provider passes all of its products on to the next provider in its category.

### Amazon

Uses the Amazon Creators API.

### Shopify

Shopify storefronts expose a public JSON version of any product page when `.json` is added to the product URL, e.g. `https://shop.com/products/foo` → `https://shop.com/products/foo.json`. **No auth is needed**, so `enabled` is the only SSM parameter for this provider.

The response has the same shape as Shopify's product resource. See the [Shopify product API docs](https://shopify.dev/docs/api/admin-rest/latest/resources/product#get-products-product-id). Those docs describe the authenticated Admin API. We only use the public storefront `.json` endpoint, which returns a subset of those fields.

### Skimlinks

Uses the Skimlinks Product API (`https://products.skimapis.com/v1/publisher/<publisherId>/products`). Product URLs are sent per region (UK/US) in batches of 100.

## Dev setup

Run the tests with

```
npm run test
```
