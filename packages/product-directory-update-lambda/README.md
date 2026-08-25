# product-directory-update-lambda

This lambda is responsible for populating and updating the list of products stored in the `ProductDirectoryPricingTable` DynamoDB table and the product-article relationship in `ProductDirectoryProductArticleTable`. It does not handle any pricing information. The lambda is written in Typescript.

Run the tests with

```
npm run test
```

It listens to [Crier](https://github.com/guardian/crier) events in order to find products that have been added to or removed from articles. These events are forwarded from the CAPI AWS account to the Frontend account, where this lambda lives, via an Eventbus.

```mermaid
flowchart LR
    crier([Crier]) --> eb>EventBridge CAPI bus] --Subscription Rule--> eb2>EventBridge Frontend bus] --Subscription Rule--> rb[[product-directory-update-lambda Frontend acct]]
```

The events from Crier are filtered by `detailType` - only those events with `itemType` "content" trigger the lambda.

Once an event hits the lambda it needs to be deserialized from Thrift format. If it is of `eventType` "RETRIEVABLEUPDATE" we must make a separate call to CAPI to receive the whole message.
