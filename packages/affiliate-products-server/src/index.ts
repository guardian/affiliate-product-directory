import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getCapiKey } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createPandaAuth } from './auth';

const stage = process.env.STAGE ?? '';

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);

// Only stages other than PROD are given PROD's CAPI key, and their role can only read
// PROD's pricing table. PROD always lists its own articles.
const prodCapiKey = process.env.PROD_CAPI_KEY;

export const handler = serverlessExpress({
	app: createApp({
		clientDir,
		auth,
		stage,
		capiKey: getCapiKey(),
		dynamoService: new DynamoService(stage),
		prod:
			stage !== 'PROD' && prodCapiKey
				? { capiKey: prodCapiKey, dynamoService: new DynamoService('PROD') }
				: undefined,
	}),
});
