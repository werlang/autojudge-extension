/**
 * Normalize the configured AutoJudge base URL while preserving optional base paths.
 * @param {string} value
 * @returns {string}
 */
export function normalizeBaseUrl(value) {
    if (!value || !value.trim()) {
        throw new Error('Set autojudge.baseUrl to a valid AutoJudge API URL.');
    }

    const url = new URL(value.trim());
    const pathname = url.pathname.replace(/\/+$/, '');
    url.pathname = pathname ? `${pathname}/` : '/';
    return url.toString();
}

/**
 * Build an endpoint URL against the configured AutoJudge base URL.
 * @param {string} baseUrl
 * @param {string} endpoint
 * @returns {string}
 */
function buildEndpointUrl(baseUrl, endpoint) {
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    return new URL(cleanEndpoint, normalizeBaseUrl(baseUrl)).toString();
}

/**
 * Read a JSON response and preserve backend messages on non-2xx responses.
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function readJson(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message || 'AutoJudge request failed.');
        error.statusCode = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
}

/**
 * Queue a coderunner task using the same API contract as the AutoJudge web editor.
 * @param {{ baseUrl: string, filename: string, code: string, inputs: string[], signal?: AbortSignal }} options
 * @returns {Promise<{ id: string, expireAt: number, message: string }>}
 */
export async function scheduleRun({ baseUrl, filename, code, inputs, signal }) {
    if (!Array.isArray(inputs) || !inputs.length) {
        throw new Error('AutoJudge run inputs must be provided as a non-empty array.');
    }

    const response = await fetch(buildEndpointUrl(baseUrl, 'judge'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename,
            code,
            input: JSON.stringify(inputs),
        }),
        signal,
    });

    return readJson(response);
}

/**
 * Poll an AutoJudge queued task until the backend publishes a completed result.
 * @param {{ baseUrl: string, id: string, signal?: AbortSignal, timeoutMs?: number }} options
 * @returns {Promise<any>}
 */
export async function pollRun({ baseUrl, id, signal, timeoutMs = 10 * 60 * 1000 }) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (signal?.aborted) {
            throw new Error('Run cancelled.');
        }

        const response = await fetch(buildEndpointUrl(baseUrl, `judge/${id}`), {
            method: 'GET',
            signal,
        });

        if (response.status === 404) {
            await delay(1000, signal);
            continue;
        }

        return readJson(response);
    }

    throw new Error('Timed out while waiting for the AutoJudge result.');
}

/**
 * Delay polling without losing cancellation support.
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<void>}
 */
function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);

        const onAbort = () => {
            cleanup();
            reject(new Error('Run cancelled.'));
        };

        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        };

        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
