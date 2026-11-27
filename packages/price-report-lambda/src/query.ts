import { type Region } from '@common/models';
import { BigQueryTimestamp } from '@google-cloud/bigquery';
import z from 'zod';

// BigQuery returns BIGNUMERIC as decimal objects; keep their precision as strings.
const bigNumericSchema = z.coerce
	.string()
	.regex(/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i)
	.nullable();

export const QueryRecordSchema = z.object({
	productMerchantUrl: z.string(),
	previous_price: bigNumericSchema,
	current_price: bigNumericSchema,
	previous_availability: z.string().nullable(),
	current_availability: z.string().nullable(),
	syncDate: z
		.instanceof(BigQueryTimestamp)
		.transform((timestamp) => timestamp.value),
});

export type QueryRecord = z.infer<typeof QueryRecordSchema>;

export const query = (region: Region) => `
WITH versioned_prices AS (
  SELECT
    productMerchantUrl,
    price,
    availability,
    _fivetran_synced,
    updatedBy,
    region,
    LAG(price) OVER (PARTITION BY productMerchantUrl ORDER BY _fivetran_synced) AS previous_price,
    LAG(availability) OVER (PARTITION BY productMerchantUrl ORDER BY _fivetran_synced) AS previous_availability,
  FROM datatech-fivetran.affiliate_product_directory_prod.affiliate-product-directory-pricing-PROD
)
SELECT
  productMerchantUrl,
  previous_price,
  price AS current_price,
  previous_availability,
  availability AS current_availability,
  _fivetran_synced AS syncDate
FROM versioned_prices
WHERE _fivetran_synced >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  AND  updatedBy != 'manualOverride'
  AND (previous_price != price OR previous_availability != availability)
  AND region = '${region}'
ORDER BY _fivetran_synced DESC;`;
