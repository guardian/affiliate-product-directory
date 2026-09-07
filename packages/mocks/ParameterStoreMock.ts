import { jest } from '@jest/globals';

const mockGetParametersFromParameterStore =
	jest.fn<() => Promise<Record<string, string>>>();

jest.unstable_mockModule('@common/src/parameterStore', () => ({
	getParametersFromParameterStore: mockGetParametersFromParameterStore,
}));

export { mockGetParametersFromParameterStore };
