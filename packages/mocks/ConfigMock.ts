import { jest } from '@jest/globals';
import type { Config } from '@common/src/config';

const defaultConfig: Config = {
	stack: 'test-stack',
	stage: 'TEST',
	app: 'test-app',
};

const mockGetConfig = jest.fn<() => unknown>();
mockGetConfig.mockImplementation(() => {
	return defaultConfig;
});

jest.unstable_mockModule('@common/src/config', () => {
	return {
		getConfig: mockGetConfig,
	};
});

export { mockGetConfig };
