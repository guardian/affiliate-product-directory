import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuS3Bucket } from '@guardian/cdk/lib/constructs/s3';

export function createS3(
	scope: GuStack,
	{ stage, appName }: { stage: string; appName: string },
) {
	const productDirectoryBucket = new GuS3Bucket(
		scope,
		'ProductDirectoryBucket',
		{
			app: appName,
			bucketName: `${appName}-${stage.toLowerCase()}`,
		},
	);
	return {
		productDirectoryBucket,
	};
}
