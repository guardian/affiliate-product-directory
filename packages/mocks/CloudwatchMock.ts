import { jest } from '@jest/globals';

const mockRegisterMetric = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('@common/cloudwatch', () => ({
	registerMetric: mockRegisterMetric,
}));

export { mockRegisterMetric };
