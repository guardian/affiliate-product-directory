import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import type { GuDynamoTable } from '@guardian/cdk/lib/constructs/dynamodb';
import {
	GuAllowPolicy,
	GuDynamoDBReadPolicy,
	GuDynamoDBWritePolicy,
} from '@guardian/cdk/lib/constructs/iam';

export function createPolicies(
	scope: GuStack,
	{
		stage,
		appName,
		productPricingTable,
		productArticleTable,
	}: {
		stage: string;
		appName: string;
		productPricingTable: GuDynamoTable;
		productArticleTable: GuDynamoTable;
	},
) {
	const productPricingDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
		scope,
		'ProductPricingDynamoReadPolicy',
		{ tableName: productPricingTable.tableName },
	);

	const productPricingDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
		scope,
		'ProductPricingDynamoWritePolicy',
		{ tableName: productPricingTable.tableName },
	);

	const productArticleDynamoDBReadPolicy = new GuDynamoDBReadPolicy(
		scope,
		'ProductArticleDynamoReadPolicy',
		{ tableName: productArticleTable.tableName },
	);

	const productArticleDynamoDBWritePolicy = new GuDynamoDBWritePolicy(
		scope,
		'ProductArticleDynamoWritePolicy',
		{ tableName: productArticleTable.tableName },
	);

	const skimlinksParameterStoreReadPolicy = new GuAllowPolicy(
		scope,
		'SkimlinksParameterStoreReadPolicy',
		{
			actions: [
				'ssm:GetParameter',
				'ssm:GetParameters',
				'ssm:GetParametersByPath',
			],
			resources: [
				`arn:aws:ssm:${scope.region}:${scope.account}:parameter/${stage}/frontend/${appName}/skimlinks/*`,
			],
		},
	);

	const amazonParameterStoreReadPolicy = new GuAllowPolicy(
		scope,
		'AmazonParameterStoreReadPolicy',
		{
			actions: [
				'ssm:GetParameter',
				'ssm:GetParameters',
				'ssm:GetParametersByPath',
			],
			resources: [
				`arn:aws:ssm:${scope.region}:${scope.account}:parameter/${stage}/frontend/${appName}/amazon/*`,
			],
		},
	);

	return {
		productPricingDynamoDBReadPolicy,
		productPricingDynamoDBWritePolicy,
		productArticleDynamoDBReadPolicy,
		productArticleDynamoDBWritePolicy,
		skimlinksParameterStoreReadPolicy,
		amazonParameterStoreReadPolicy,
	};
}
