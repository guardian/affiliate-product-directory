# product-price-update-lambda

This lambda is responsible for updating the list of products stored in the `ProductDirectoryPricingTable`. The lambda is written in Typescript.

## Architecture

The lambda is configured to be triggered by an Eventbridge rule that runs every day at a set time. This rule is defined as part of the `GuScheduledLambda` CDK construct.

The event that is fired from Eventbridge currently does not currently send a payload and the lambda will simply attempt to update all products within the Prices DB.

Once an event hits the lambda, the main orchestrator is the `ProductsUpdater.ts` class which categorises each product by which partner/method we should use to update their respective prices. This is mainly to take advantage of any batch offerings from our price providers.

### Processing updates

If a request for product prices is successful (2XX) but no data can be found, this will not throw an error and a log will be made to declare this information.

## Dev setup

Run the tests with

```
npm run test
```
