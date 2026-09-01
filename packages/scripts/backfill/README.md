# Backfill

This script was used to create the initial backfill of products into the product directory DB.

To execute the backfill you need to run two commands: a script and an AWS CLI command.

### Prerequisites

1. A CAPI key for the environment
2. The AWS credentials for Frontend account (Developer tier)

### Running the script

First run the script:

`export CAPI_KEY=<key here> && npx tsx packages/scripts/backfill/create-backfill-events.ts <stack>`

This script calls CAPI to get all articles in "The Filter" section and their IDs. It should generate the JSON file which is referenced below.

Run the AWS CLI put events command:

```
aws --profile frontend events put-events \
  --region eu-west-1 \
  --entries file://packages/scripts/backfill/output/backfill-events.json
```
