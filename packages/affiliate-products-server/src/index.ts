import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { createApp } from './app';
import { createPandaAuth } from './auth';

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(process.env.STAGE ?? '');

export const handler = serverlessExpress({
	app: createApp({ clientDir, auth }),
});
