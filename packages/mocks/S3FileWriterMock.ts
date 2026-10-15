import { jest } from '@jest/globals';
import type { PricedProduct } from '@common/models';

const mockWriteProductsToS3File =
	jest.fn<(products: PricedProduct[]) => Promise<void>>();

jest.unstable_mockModule('@prices-csv/S3FileWriter', () => ({
	S3FileWriter: jest.fn(() => ({
		writeProductsToS3File: mockWriteProductsToS3File,
	})),
}));

export { mockWriteProductsToS3File };
