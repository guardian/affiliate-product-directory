import { jest } from '@jest/globals';
import { mockGetParametersCommand, mockSend } from '../../mocks/SSMmock';
import { getParametersFromParameterStore } from './parameterStore';

afterEach(() => {
	mockSend.mockReset();
});

describe('getParametersFromParameterStore', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns a name to value map for the resolved parameters', async () => {
		mockSend.mockResolvedValue({
			Parameters: [
				{ Name: '/CODE/frontend/x/skimlinks/id', Value: 'the-id' },
				{ Name: '/CODE/frontend/x/skimlinks/secret', Value: 'the-secret' },
			],
			InvalidParameters: [],
		});

		const result = await getParametersFromParameterStore([
			'/CODE/frontend/x/skimlinks/id',
			'/CODE/frontend/x/skimlinks/secret',
		]);

		expect(result).toEqual({
			'/CODE/frontend/x/skimlinks/id': 'the-id',
			'/CODE/frontend/x/skimlinks/secret': 'the-secret',
		});
	});

	it('defaults WithDecryption to false', async () => {
		mockSend.mockResolvedValue({ Parameters: [] });

		await getParametersFromParameterStore(['/a']);

		expect(mockGetParametersCommand).toHaveBeenCalledWith({
			Names: ['/a'],
			WithDecryption: false,
		});
	});

	it('passes WithDecryption through when requested', async () => {
		mockSend.mockResolvedValue({ Parameters: [] });

		await getParametersFromParameterStore(['/a', '/b'], true);

		expect(mockGetParametersCommand).toHaveBeenCalledWith({
			Names: ['/a', '/b'],
			WithDecryption: true,
		});
	});

	it('throws listing every invalid parameter', async () => {
		mockSend.mockResolvedValue({
			Parameters: [],
			InvalidParameters: ['/missing/one', '/missing/two'],
		});

		await expect(
			getParametersFromParameterStore(['/missing/one', '/missing/two']),
		).rejects.toThrow(
			'Parameters not found or have no value: /missing/one, /missing/two',
		);
	});

	it('returns an empty object when the response has no Parameters', async () => {
		mockSend.mockResolvedValue({});

		await expect(getParametersFromParameterStore([])).resolves.toEqual({});
	});

	it('propagates a failure from the SSM client', async () => {
		const error = new Error('SSM is unavailable');
		mockSend.mockRejectedValue(error);

		await expect(getParametersFromParameterStore(['/a'])).rejects.toThrow(
			error,
		);
	});
});
