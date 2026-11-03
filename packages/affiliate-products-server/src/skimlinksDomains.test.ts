import type { S3Client } from '@aws-sdk/client-s3';
import { jest } from '@jest/globals';
import {
	createSkimlinksDomains,
	parseSkimlinksDomains,
} from './skimlinksDomains';

describe('parseSkimlinksDomains', () => {
	it('reads the comma-separated domains', () => {
		expect(parseSkimlinksDomains('argos.co.uk, JohnLewis.com,,\n')).toEqual(
			new Set(['argos.co.uk', 'johnlewis.com']),
		);
	});
});

describe('createSkimlinksDomains', () => {
	// An S3 client answering each read with the next of these, a file's contents or an error.
	const s3With = (...answers: Array<string | Error>) => {
		const send = jest.fn(() => {
			const answer = answers.shift();
			return answer instanceof Error || answer === undefined
				? Promise.reject(answer ?? new Error('No more answers'))
				: Promise.resolve({
						Body: { transformToString: () => Promise.resolve(answer) },
					});
		});
		return { client: { send } as unknown as S3Client, send };
	};

	let time = 0;
	const now = () => time;
	const hour = 60 * 60 * 1000;

	beforeEach(() => {
		time = 0;
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('keeps the domains for an hour', async () => {
		const { client, send } = s3With('a.example', 'b.example');
		const read = createSkimlinksDomains(client, now);

		expect(await read()).toEqual(new Set(['a.example']));
		time = hour - 1;
		expect(await read()).toEqual(new Set(['a.example']));
		time = hour;
		expect(await read()).toEqual(new Set(['b.example']));
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("is undefined when the file can't be read, and tries again next time", async () => {
		const { client } = s3With(new Error('Access denied'), 'a.example');
		const read = createSkimlinksDomains(client, now);

		expect(await read()).toBeUndefined();
		expect(await read()).toEqual(new Set(['a.example']));
	});

	it("keeps the older domains when they can't be read again, or the file is empty", async () => {
		const { client } = s3With('a.example', new Error('Access denied'), '');
		const read = createSkimlinksDomains(client, now);

		await read();
		time = hour;
		expect(await read()).toEqual(new Set(['a.example']));
		expect(await read()).toEqual(new Set(['a.example']));
	});
});
