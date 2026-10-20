import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { getCapiKey } from '@common/config';
import { getCapiKey } from '@common/config';
import { getConfig } from '@common/config';
import { DynamoService } from '@common/database-service';
import { createApp } from './app';
import { createPandaAuth } from './auth';
import { createPreviewFetch } from './previewCapi';

const { stage } = getConfig();

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

// Created once per Lambda instance, so warm invocations reuse the cached Panda key and permissions.
const auth = createPandaAuth(stage);
const prodCapiKey = process.env.PROD_CAPI_KEY;

// The roles that give access to each stage's Preview CAPI, for its drafts.
const previewRoleArn = process.env.PREVIEW_CAPI_ROLE_ARN;
const prodPreviewRoleArn = process.env.PROD_PREVIEW_CAPI_ROLE_ARN;

export const handler = serverlessExpress({
	app: createApp({
		clientDir,
		auth,
		stage,
		capiKey: getCapiKey(),
		fetchPreview: previewRoleArn
			? createPreviewFetch(previewRoleArn)
			: undefined,
		dynamoService: new DynamoService(stage),
		prod:
			stage !== 'PROD' && prodCapiKey
				? {
						capiKey: prodCapiKey,
						fetchPreview: prodPreviewRoleArn
							? createPreviewFetch(prodPreviewRoleArn)
							: undefined,
						dynamoService: new DynamoService('PROD'),
					}
				: undefined,
	}),
});
