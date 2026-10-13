import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getConfig } from '@common/config';
import { DynamoService } from '../../common/src/database-service';
import { createApp } from './app';
import { createPandaAuth } from './auth';

const { stage } = getConfig();

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);

const dynamoService = new DynamoService(stage);

export const handler = serverlessExpress({
	app: createApp({ clientDir, auth, dynamoService }),
});
