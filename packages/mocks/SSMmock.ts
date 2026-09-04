import { jest } from '@jest/globals';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockGetParametersCommand = jest.fn();

jest.mock('@aws-sdk/client-ssm', () => ({
	SSMClient: jest.fn(() => ({
		send: mockSend,
	})),
	GetParametersCommand: mockGetParametersCommand,
}));

export { mockSend, mockGetParametersCommand };
