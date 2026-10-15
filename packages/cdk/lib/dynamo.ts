import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb';
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';

export function createDynamoTables(
	scope: GuStack,
	{ stage, appName }: { stage: string; appName: string },
) {
	return {
		productPricingTable: productPricingTable(scope, { stage, appName }),
		productArticleTable: productArticleTable(scope, { stage, appName }),
	};
}

function productPricingTable(
	scope: GuStack,
	{ stage, appName }: { stage: string; appName: string },
) {
	return new GuDynamoTable(scope, 'ProductDirectoryPricingTable', {
		billingMode: BillingMode.PAY_PER_REQUEST,
		devXBackups: { enabled: true },
		partitionKey: {
			name: 'productMerchantUrl',
			type: AttributeType.STRING,
		},
		tableName: `${appName}-pricing-${stage}`,
	});
}

function productArticleTable(
	scope: GuStack,
	{ stage, appName }: { stage: string; appName: string },
) {
	const table = new GuDynamoTable(
		scope,
		'ProductDirectoryProductArticleTable',
		{
			billingMode: BillingMode.PAY_PER_REQUEST,
			devXBackups: { enabled: true },
			partitionKey: {
				name: 'productMerchantUrl',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'articleUrl',
				type: AttributeType.STRING,
			},
			tableName: `${appName}-product-article-${stage}`,
		},
	);

	table.addGlobalSecondaryIndex({
		indexName: 'articleUrl-index',
		partitionKey: {
			name: 'articleUrl',
			type: AttributeType.STRING,
		},
	});

	return table;
}
