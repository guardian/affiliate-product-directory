import { jest } from '@jest/globals';

const mockGetCapiKey = jest.fn<() => Promise<string>>();
mockGetCapiKey.mockImplementation(() => Promise.resolve('test-key'));

jest.unstable_mockModule('@common/capiKey', () => ({
	getCapiKey: mockGetCapiKey,
}));

export { mockGetCapiKey };
