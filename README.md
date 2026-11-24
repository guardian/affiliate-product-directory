# affiliate-product-directory

<!---
The top-level description should provide a short summary of the project, ensuring the reader is in the right place.
Keep this brief and provide suitable onward links, as further detail will be provided in the subsequent sections.
This description should consider a wider audience as it is likely to be the first piece of documentation a person may
see. As such, this description should be carefully considered.
-->

The Affiliate Product Directory is a tool and set of AWS services for finding and managing affiliate products in The Filter articles. It stores product metadata and prices, powers live pricing in articles, and provides an internal tool for browsing articles and their affiliate links.

## Contents

- [Introduction](#1-introduction)
- [Getting Started](#2-getting-started)
- [How It Works](#3-how-it-works)
- [Useful Links](#4-useful-links)
- [Terminology](#5-terminology)

## 1. Introduction

<!---
The section should provide a clear explanation for why the project exists and what it does. Different types of readers
should be considered, including users, engineers, and managers. More specific and technical detail should be provided
under "How it works".

Areas to include:
 - Who are the users of this project?
 - Why was the project made?
 - What core features does the project provide?
 - Which other services does it integrate with (provide links)?
 - [When applicable] What does the project look like (include images)?

-->

This project serves the Product Directory of affiliate products in The Filter articles. It includes a web tool for browsing articles, products, retailer links and prices, as well as AWS lambdas that keep the directory and its prices up to date.

The directory solves two main challenges: products are spread across articles, with no centralised way to find them, and live pricing needs a maintained source of product prices. The directory stores metadata rather than duplicating the editorially driven content in articles.

The internal Affiliate Products tool is a React app for browsing The Filter and The Filter US articles, inspecting their products and retailer links, checking link counts, and viewing or editing prices. It also provides a Composer embed that shows products and prices for a draft article. Access requires a valid Panda cookie and the `affiliate_products_access` permission; see the [client README](packages/affiliate-products-client/README.md) for details.

## 2. Getting Started

<!---
This section should provide clear steps for an engineer to begin utilising or contributing to the project.

This should include setup and running instructions, as well as advice for contributing to or releasing updates to the project.
-->

Install the dependencies:

```
npm install
```

To run the affiliate products tool locally, get AWS credentials for the Frontend account from Janus, then start its server and client:

```
npm run affiliate-products-dev
```

The tool is then at http://localhost:5173. See the client's [README](packages/affiliate-products-client/README.md#running-locally) for setup details and how to try the Composer embed.

To serve it at https://affiliate-products.local.dev-gutools.co.uk too, as Composer's local dev build needs, set up nginx and a local certificate once (macOS, needs Homebrew and your password):

```
./scripts/setup.sh
```

Run the tests with

```
npm run test
```

## 3. How It Works

<!---
This section provides an opportunity to clarify the design of the project. It should go beyond the introduction to
explain the key technical aspects of the project.

Areas to include:
 - Which core technologies does the project use?
 - What is the architecture of the project (include a diagram)?
 - What subprojects does the project have? What do they each do?
 - What are the key design concepts behind the project?
 - What might surprise an engineer new to the project?
-->

The project includes the Affiliate Products web tool, TypeScript lambdas, and DynamoDB tables. Crier content-update events are forwarded through EventBridge to keep article/product relationships current. A scheduled lambda updates prices using Amazon, Shopify and Skimlinks; changes to the pricing table trigger another lambda to publish the live-prices CSV consumed by the frontend.

### Affiliate Products tool

The tool consists of a React/Vite client and an Express server deployed as a Lambda behind API Gateway. It lists Filter articles from CAPI and reads their product prices from the pricing table. Editors can also use its Composer embed to inspect draft products, preview prices, and set prices manually. See the [client README](packages/affiliate-products-client/README.md) for the API, embed protocol, local development and deployment details.

### `product-directory-update-lambda`

This lambda processes Crier updates to add or remove products and article relationships. Product removals are soft-deleted. See the [lambda README](packages/product-directory-update-lambda/README.md) for more detail.

### `product-price-update-lambda`

This lambda runs daily from an EventBridge rule and updates prices using the configured providers. See the [lambda README](packages/product-price-update-lambda/README.md) for provider configuration and metrics.

### `product-prices-csv-lambda`

This lambda responds to pricing-table changes and rewrites the live-prices CSV in the `aws-frontend-store` S3 bucket. The CSV is consumed by the frontend; neither of the directory update lambdas writes it directly. See the [lambda README](packages/product-prices-csv-lambda/README.md) for how it handles DynamoDB stream updates.

### Backfill

The directory was initially populated using a backfill script that finds articles in The Filter and The Filter US and generates events to process them through the Crier update flow. See the [backfill README](packages/scripts/backfill/README.md) for prerequisites and instructions.

## 4. Useful Links

<!---
This section should provide helpful links to other useful resources.

These could be:
 - Further detailed project documentation
        - ADRs
        - Runbooks
        - Feature documentation
        - User training
 - Related projects (including a brief description of the relationship)
 - Documentation of third-party libraries
-->

- [Product Directory ADR](https://docs.google.com/document/d/1JC8t9CziRG0-HEATOKTQ3HvnXViUnH55hhy0tjKqbos)
- [The Filter handbook](https://docs.google.com/document/d/1S36wUQ6mwhCHwICH_4Bwd3XBvFaVl951RyNmWP2SwQs/edit?tab=t.0#heading=h.ys3casdc8bke)

## 5. Terminology

<!---
This section should be linked to from previous sections and provide unambiguous definitions for the key terms
in the project. These are likely to be domain specific phrases which are novel to the project. They could also be phrases
which have a specific meaning in the context of the project. If there is any doubt around a term, include it here!
-->

`The Filter`

- The Filter is a section on the Guardian [UK](https://www.theguardian.com/uk/thefilter) and [US](https://www.theguardian.com/thefilter-us) editions that serve product reviews and other product oriented journalism. The Filter makes money by having affiliate links embedded in the content.

`Region`

- The market a product belongs to, either `GB` or `US`. The price update lambda uses it to group products and to choose the matching marketplace and credentials from each price provider. We use `GB` rather than `UK` because `GB` is the ISO 3166-1 country code.
