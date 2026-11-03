# product-prices-csv-lambda

This lambda writes the prices CSV that the frontend reads live prices from: `<STAGE>/affiliates/product-prices.csv` in the `aws-frontend-store` bucket. It runs whenever the pricing table changes, however the change was made, so the price update lambda and the directory update lambda don't write the CSV themselves.

## How it works

The pricing table has a DynamoDB stream. Lambda collects up to a minute's changes from it, then invokes `index.ts`, which hands them to `csv-publisher.ts`. The stream's records only say that something changed: the function reads the whole table, with consistent reads, and rewrites the CSV with every product that hasn't been removed and has a price. Only one of these runs at a time, so an older read of the table can't overwrite a newer CSV.

The stream is split into shards, one per table partition, and Lambda batches each shard separately. So a burst of writes, like a price run, arrives as several batches, one after another. The function remembers when its last rewrite started reading the table and skips a batch whose changes were all made more than a few seconds before that, because that read already included them. A new lambda instance doesn't know when the last read was, so it always rewrites.

If a run fails it is retried twice. After that the batch is dropped and the lambda's alarm fires; the next change to the table rewrites the whole CSV again.
