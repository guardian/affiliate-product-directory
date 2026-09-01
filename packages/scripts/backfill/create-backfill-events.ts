/*
Fetches all Filter article IDs from CAPI and writes a backfill event to events.json.

Usage: export CAPI_KEY=<your key> && tsx get-article-ids.ts <STACK>
 */

import { writeFile } from 'fs/promises';

interface CapiSearchResponse {
	response: {
		status: string;
		results: Array<{ id: string }>;
	};
}

function getCapiKey(): string {
	const capiKey = process.env.CAPI_KEY;
	if (capiKey === undefined) {
		throw new Error('Environment variable CAPI_KEY is not set');
	}
	return capiKey;
}

function getBaseCapiUrl(stack: string): string {
	return stack === 'PROD'
		? 'https://content.guardianapis.com'
		: 'https://content.code.dev-guardianapis.com';
}

async function getArticleIds(stack: string): Promise<string[]> {
	const capiKey = getCapiKey();
	const url = `${getBaseCapiUrl(stack)}/search?section=thefilter&api-key=${capiKey}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`CAPI request failed with status ${response.status}: ${await response.text()}`,
		);
	}

	const body = (await response.json()) as CapiSearchResponse;
	return body.response.results.map((result) => result.id);
}

async function main() {
	let stack = process.argv[2];
	stack ??= 'CODE';

	const articleIds = await getArticleIds(stack);

	const formattedEvents = [
		{
			EventBusName: `publication-events-${stack}`,
			Source: 'backfill',
			DetailType: 'backfill-request',
			Detail: JSON.stringify({
				articleIds,
			}),
		},
	];

	const outputPath = './packages/scripts/backfill/output/backfill-events.json';
	await writeFile(outputPath, JSON.stringify(formattedEvents, null, 2));
	console.log(`Wrote ${articleIds.length} article IDs to ${outputPath}`);
}

await main();
export {};
