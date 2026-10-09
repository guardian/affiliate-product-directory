import path from 'path';
import serverlessExpress from '@codegenie/serverless-express';
import { createApp } from './app';

// The build zips the client into `client/` next to this bundle.
const clientDir = path.join(process.env.LAMBDA_TASK_ROOT ?? '', 'client');

export const handler = serverlessExpress({ app: createApp({ clientDir }) });
