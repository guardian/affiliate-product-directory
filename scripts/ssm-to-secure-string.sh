#!/usr/bin/env bash
# Converts SSM parameters to SecureString, keeping their values.
# Usage: scripts/ssm-to-secure-string.sh <parameter name>...

# scripts/ssm-to-secure-string.sh \
#  /CODE/frontend/affiliate-product-directory/capi-key \
#  /CODE/frontend/affiliate-product-directory/amazon/products/clientSecret/UK \
#  /CODE/frontend/affiliate-product-directory/amazon/products/clientSecret/US \
#  /CODE/frontend/affiliate-product-directory/skimlinks/products/clientSecret

set -euo pipefail

for name in "$@"; do
	type="$(aws ssm get-parameter --profile frontend --region eu-west-1 \
		--name "$name" --query Parameter.Type --output text)"
	if [[ "$type" == "SecureString" ]]; then
		echo "Skipped $name, already a SecureString"
		continue
	fi
	value="$(aws ssm get-parameter --profile frontend --region eu-west-1 \
		--name "$name" --query Parameter.Value --output text)"
	aws ssm put-parameter --profile frontend --region eu-west-1 \
		--name "$name" --type SecureString --overwrite --value "$value" >/dev/null
	echo "Converted $name"
done
