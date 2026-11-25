import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'eu-west-1' });

/**
 *
 * @param names - SSM parameter store paths
 * @param withDecryption - Whether to decrypt SecureString parameters. Ignored for String
 * parameters, so it's on by default.
 * @returns Object of key-value pairs {SSM path => retrieved value}
 */
export async function getParametersFromParameterStore(
	names: string[],
	withDecryption = true,
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
		(response.Parameters ?? []).map((p) => {
			if (!p.Name || !p.Value) {
				throw new Error(
					`Received a parameter with a missing Name or Value: ${JSON.stringify(p)}`,
				);
			}
			return [p.Name, p.Value];
		}),
	);
}
