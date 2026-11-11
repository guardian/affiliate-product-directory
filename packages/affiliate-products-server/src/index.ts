import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getCapiKey } from '@common/config';
import { getConfig } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createPandaAuth } from './auth';
import { createSkimlinksDomains } from './skimlinksDomains';

const { stage } = getConfig();

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);
const prodCapiKey = process.env.PROD_CAPI_KEY;

export const handler = serverlessExpress({
	app: createApp({
		clientDir,
		auth,
		stage,
		capiKey: getCapiKey(),
		dynamoService: new DynamoService(stage),
		readSkimlinksDomains: createSkimlinksDomains(),
		prod:
			stage !== 'PROD' && prodCapiKey
				? {
						capiKey: prodCapiKey,
						dynamoService: new DynamoService('PROD'),
					}
				: undefined,
	}),
});
