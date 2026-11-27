import { getConfig } from '@common/config';
import { appName } from '@common/constants';
import { getParametersFromParameterStore } from '@common/parameterStore';
import type { Handler } from 'aws-lambda';
import { buildAuthClient, runQuery } from './bigquery';
import { query, QueryRecordSchema } from './query';

async function getGcpConfig(): Promise<string> {
	const { stage, stack } = getConfig();
	const name = `/${stage}/${stack}/${appName}/gcp-credentials-config`;
	return getParametersFromParameterStore([name], true).then(
		(parameters) => parameters[name]!,
	);
}

export async function main(): Promise<void> {
	const gcpConfig = await getGcpConfig();
	const authClient = await buildAuthClient(gcpConfig);

	// Let's start with just GB for now
	const [rows] = await runQuery(authClient, 'datatech-fivetran', query('GB'));
	console.log('rows', rows);
	const records = QueryRecordSchema.array().parse(rows);
	console.log(records);
}

export const eventHandler: Handler = async () => {
	await main();
};
