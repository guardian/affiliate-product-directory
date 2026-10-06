# affiliate-products-client

A single page React app (Vite) for browsing the affiliate product directory.

It is currently only deployed to CODE, at https://affiliate-products.code.dev-gutools.co.uk, behind Google auth.

## Running locally

From the repository root:

```
npm install
npm -w affiliate-products-client start
```

Then go to http://localhost:5173.

## Deployment

CI builds the app and deploys it with [guardian/actions-static-site](https://github.com/guardian/actions-static-site), which creates a `deploy-PROD-affiliate-products-CODE` stack in the Deploy Tools AWS account. The Riff-Raff project is `deploy::affiliate-products-CODE`. No CDK in this repo is involved.
