import type { SSMClient } from '@aws-sdk/client-ssm';
import { jest } from '@jest/globals';
import { createProdPriceEditingSwitch } from './prodPriceEditing';

describe('createProdPriceEditingSwitch', () => {
	// An SSM client answering each read with the next of these, a value or an error.
	const ssmWith = (...answers: Array<string | Error>) => {
		const send = jest.fn(() => {
			const answer = answers.shift();
			return answer instanceof Error || answer === undefined
				? Promise.reject(answer ?? new Error('No more answers'))
				: Promise.resolve({ Parameter: { Value: answer } });
		});
		return { client: { send } as unknown as SSMClient, send };
	};

	const notFound = Object.assign(new Error('Parameter not found'), {
		name: 'ParameterNotFound',
	});

	let time = 0;
	const now = () => time;

	beforeEach(() => {
		time = 0;
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([
		['true', true],
		[' TRUE\n', true],
		['false', false],
		['yes', false],
	])('reads %j as %s', async (value, enabled) => {
		const { client } = ssmWith(value);

		await expect(
			createProdPriceEditingSwitch('/CODE/switch', client, now)(),
		).resolves.toBe(enabled);
	});

	it('is off when the parameter is missing, or unreadable', async () => {
		const { client } = ssmWith(notFound, new Error('Access denied'));
		const isEnabled = createProdPriceEditingSwitch('/CODE/switch', client, now);

		await expect(isEnabled()).resolves.toBe(false);
		time = 60 * 1000;
		await expect(isEnabled()).resolves.toBe(false);
		expect(console.error).toHaveBeenCalledTimes(1);
	});

	it('keeps the value for a minute', async () => {
		const { client, send } = ssmWith('true', 'false');
		const isEnabled = createProdPriceEditingSwitch('/CODE/switch', client, now);

		await expect(isEnabled()).resolves.toBe(true);
		time = 59 * 1000;
		await expect(isEnabled()).resolves.toBe(true);
		expect(send).toHaveBeenCalledTimes(1);

		time = 60 * 1000;
		await expect(isEnabled()).resolves.toBe(false);
		expect(send).toHaveBeenCalledTimes(2);
	});
});
