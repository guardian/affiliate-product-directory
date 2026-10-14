import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getCapiBaseUrl, getCapiKey } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createPandaAuth } from './auth';
import { createCapiArticles, getComposerBaseUrl } from './capi';
import { createProductPrices } from './productPrices';

const stage = process.env.STAGE ?? '';

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);

const listArticles = createCapiArticles({
	baseUrl: getCapiBaseUrl(stage),
	apiKey: getCapiKey(),
	composerBaseUrl: getComposerBaseUrl(stage),
});

// Reads the stage's pricing table on every request, so nothing is cached between them.
const dynamoService = new DynamoService(stage);
const getProductPrices = createProductPrices((urls) =>
	dynamoService.getProductsByUrl(urls),
);

export const handler = serverlessExpress({
	app: createApp({ clientDir, auth, listArticles, getProductPrices }),
});
