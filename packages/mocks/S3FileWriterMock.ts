import { jest } from '@jest/globals';
import type { Product } from '@common/models';

const mockWriteProductsToS3File =
	jest.fn<(products: Product[]) => Promise<void>>();

jest.unstable_mockModule('@price-update/S3FileWriter', () => ({
	S3FileWriter: jest.fn(() => ({
		writeProductsToS3File: mockWriteProductsToS3File,
	})),
}));

export { mockWriteProductsToS3File };
