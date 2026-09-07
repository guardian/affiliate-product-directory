import { jest } from '@jest/globals';

const mockGetAllItems = jest.fn<() => Promise<unknown[]>>();
const mockBatchUpdateItems = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('@common/src/dynamoDB', () => ({
	getAllItems: mockGetAllItems,
	batchUpdateItems: mockBatchUpdateItems,
}));

export { mockGetAllItems, mockBatchUpdateItems };
