import type { Handler } from 'aws-lambda';

export async function main(): Promise<void> {}

export const eventHandler: Handler = async () => {
	await main();
};
