/*
Fetches all Filter article IDs from CAPI and writes a backfill event to events.json.

Usage: export CAPI_KEY=<your key> && tsx get-article-ids.ts <STACK>
 */

import { writeFile } from 'fs/promises';

interface CapiSearchResponse {
	response: {
		status: string;
		currentPage: number;
		pages: number;
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

function getArticleIdsFromResponse(searchResponse: CapiSearchResponse) {
	return searchResponse.response.results.map((result) => result.id);
}

async function getArticleIdsForPage(
	stack: string,
	capiKey: string,
	page: number,
): Promise<CapiSearchResponse> {
	const url = `${getBaseCapiUrl(stack)}/search?section=thefilter&page=${page}&api-key=${capiKey}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`CAPI request failed with status ${response.status}: ${await response.text()}`,
		);
	}

	const body = (await response.json()) as CapiSearchResponse;
	return body;
}

async function getAllArticleIds(stack: string): Promise<string[]> {
	const capiKey = getCapiKey();
	let articleIds: string[] = [];
	const firstPage = await getArticleIdsForPage(stack, capiKey, 1);
	articleIds = articleIds.concat(getArticleIdsFromResponse(firstPage));

	let page = 2;
	while (page <= firstPage.response.pages) {
		const nextPage = await getArticleIdsForPage(stack, capiKey, page);
		articleIds = articleIds.concat(getArticleIdsFromResponse(nextPage));
		page++;
	}

	return articleIds;
}

async function main() {
	let stack = process.argv[2];
	stack ??= 'CODE';

	const articleIds = await getAllArticleIds(stack);

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
