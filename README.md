# affiliate-product-directory

<!---
The top-level description should provide a short summary of the project, ensuring the reader is in the right place.
Keep this brief and provide suitable onward links, as further detail will be provided in the subsequent sections.
This description should consider a wider audience as it is likely to be the first piece of documentation a person may
see. As such, this description should be carefully considered.
-->

The Affiliate Product Directory is a set of resources and lambdas which compose a database of affiliate product links in (The Filter) articles and meta data about them. This powers features such as live pricing.

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

This project exists to serve the Product Directory of affiliate products in The Filter articles. It comprises of lambdas to populate and update the database tables as products are added and removed from articles, and to keep the pricing information about them up to date.

The directory exists to solve two main challenges: products are spread around articles and there was previously no other centralised way to find them; and to support live pricing in Filter articles. The directory only exists to store metadata, and does not duplicate the editorially driven content stored in articles.

## 2. Getting Started

<!---
This section should provide clear steps for an engineer to begin utilising or contributing to the project.

This should include setup and running instructions, as well as advice for contributing to or releasing updates to the project.
-->

<!-- Fill this in once we know how to run locally -->

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

The project consists of Typescript lambdas and DynamoDB tables.

### `product-directory-update-lambda`

This lambda is responsible for handling updates that add or remove products within articles.  
See its [README](packages/product-directory-update-lambda//README.md) for more detail.

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
