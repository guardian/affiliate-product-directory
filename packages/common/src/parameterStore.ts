import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'eu-west-1' });

/**
 *
 * @param names - SSM parameter store paths
 * @param withDecryption
 * @returns Object of key-value pairs {SSM path => retrieved value}
 */
export async function getParametersFromParameterStore(
	names: string[],
	withDecryption = false,
): Promise<Record<string, string>> {
	const response = await ssmClient.send(
		new GetParametersCommand({ Names: names, WithDecryption: withDecryption }),
	);

	if (response.InvalidParameters?.length) {
		throw new Error(
			`Parameters not found or have no value: ${response.InvalidParameters.join(', ')}`,
		);
	}

	return Object.fromEntries(
		(response.Parameters ?? []).map((p) => [
			p.Name as string,
			p.Value as string,
		]),
	);
}
