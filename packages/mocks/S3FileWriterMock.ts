import { jest } from '@jest/globals';
import type { PricedProduct } from '@common/models';

const mockWriteProductsToS3Files =
	jest.fn<(products: PricedProduct[]) => Promise<void>>();

jest.unstable_mockModule('@price-update/S3FileWriter', () => ({
	S3FileWriter: jest.fn(() => ({
		writeProductsToS3Files: mockWriteProductsToS3Files,
	})),
}));

export { mockWriteProductsToS3Files };
