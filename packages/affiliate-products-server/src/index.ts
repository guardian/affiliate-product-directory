import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getBucketName, getCapiBaseUrl, getCapiKey } from '@common/config';
import { getCachedProductPricesKey } from '@common/constants';
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

// Also created once per Lambda instance, so warm invocations reuse the cached prices file.
const getProductPrices = createProductPrices({
	bucket: getBucketName(),
	key: getCachedProductPricesKey(stage),
});

export const handler = serverlessExpress({
	app: createApp({ clientDir, auth, listArticles, getProductPrices }),
});
