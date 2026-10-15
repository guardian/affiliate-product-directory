import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getCapiKey } from '@common/config';
import { createApp } from './app';
import { createPandaAuth } from './auth';
import { createDataSource } from './dataSource';

const stage = process.env.STAGE ?? '';

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);

const { listArticles, getProductPrices } = createDataSource(
	stage,
	getCapiKey(),
);

// Only stages other than PROD are given PROD's CAPI key, and their role can only read
// PROD's pricing table. PROD always lists its own articles.
const prodCapiKey = process.env.PROD_CAPI_KEY;
const prodData =
	stage !== 'PROD' && prodCapiKey
		? createDataSource('PROD', prodCapiKey)
		: undefined;

export const handler = serverlessExpress({
	app: createApp({
		clientDir,
		auth,
		listArticles,
		getProductPrices,
		prodData,
	}),
});
