import { jest } from '@jest/globals';
import { mockGetConfig } from '../../mocks/ConfigMock';
import type { registerMetric as RegisterMetric } from './cloudwatch';

const mockSend = jest.fn<() => Promise<unknown>>();
const mockPutMetricDataCommand = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-cloudwatch', () => ({
	CloudWatchClient: jest.fn(() => ({
		send: mockSend,
	})),
	PutMetricDataCommand: mockPutMetricDataCommand,
}));

describe('registerMetric', () => {
	let registerMetric: typeof RegisterMetric;

	beforeAll(async () => {
		({ registerMetric } = await import('./cloudwatch'));
	});
	beforeEach(() => {
		jest.clearAllMocks();
		mockSend.mockResolvedValue({ $metadata: {} });
	});

	it('records the metric in PROD, by stack and stage', async () => {
		mockGetConfig.mockReturnValueOnce({
			stack: 'frontend',
			stage: 'PROD',
			app: 'test-app',
		});

		await registerMetric('SkimlinksProductsFetched', 3);

		expect(mockSend).toHaveBeenCalledTimes(1);
		expect(mockPutMetricDataCommand).toHaveBeenCalledWith({
			Namespace: 'AffiliateProductDirectory',
			MetricData: [
				expect.objectContaining({
					MetricName: 'SkimlinksProductsFetched',
					Value: 3,
					Dimensions: [
						{ Name: 'Stack', Value: 'frontend' },
						{ Name: 'Stage', Value: 'PROD' },
					],
				}),
			],
		});
	});

	it("doesn't record metrics outside PROD", async () => {
		mockGetConfig.mockReturnValueOnce({
			stack: 'frontend',
			stage: 'CODE',
			app: 'test-app',
		});

		await registerMetric('SkimlinksProductsFetched', 3);

		expect(mockPutMetricDataCommand).not.toHaveBeenCalled();
		expect(mockSend).not.toHaveBeenCalled();
	});
});
