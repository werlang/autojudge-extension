import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeBaseUrl, pollRun, scheduleRun } from './autojudge-client.js';

describe('normalizeBaseUrl', () => {
    it('preserves an optional base path and normalizes a trailing slash', () => {
        expect(normalizeBaseUrl('https://example.com/api')).toBe('https://example.com/api/');
        expect(normalizeBaseUrl('https://example.com/api///')).toBe('https://example.com/api/');
    });

    it('rejects blank values', () => {
        expect(() => normalizeBaseUrl('   ')).toThrow('Set autojudge.baseUrl to a valid AutoJudge API URL.');
    });
});

describe('scheduleRun', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('posts the current AutoJudge payload shape to the judge endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'run-123', expireAt: 123, message: 'queued' }),
        });

        vi.stubGlobal('fetch', fetchMock);

        await expect(scheduleRun({
            baseUrl: 'https://example.com/api',
            filename: 'solution.py',
            code: 'print(1)',
            input: '42',
        })).resolves.toEqual({ id: 'run-123', expireAt: 123, message: 'queued' });

        expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/judge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: 'solution.py',
                code: 'print(1)',
                input: JSON.stringify(['42']),
            }),
            signal: undefined,
        });
    });
});

describe('pollRun', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('retries 404 responses and returns the first completed payload', async () => {
        vi.useFakeTimers();

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ status: 404 })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ status: 'accepted', output: 'ok' }),
            });

        vi.stubGlobal('fetch', fetchMock);

        const runPromise = pollRun({
            baseUrl: 'https://example.com/api/',
            id: 'run-123',
            timeoutMs: 2_500,
        });

        await vi.advanceTimersByTimeAsync(1_000);

        await expect(runPromise).resolves.toEqual({ status: 'accepted', output: 'ok' });
        expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://example.com/api/judge/run-123', {
            method: 'GET',
            signal: undefined,
        });
        expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/api/judge/run-123', {
            method: 'GET',
            signal: undefined,
        });
    });
});