import path from 'path';

/**
 * Render the details of an AutoJudge run result in the output channel before the run is sent, after it is queued, and when results are received.
 * @param {import('vscode').OutputChannel} outputChannel 
 * @param {{ filename: string, baseUrl: string, resolvedInputs: { sourceLabel: string, inputs: string[] }, resolvedOutputs?: { sourceLabel: string } | null }} param1 
 */
export function writePreSendOutput(outputChannel, { filename, baseUrl, resolvedInputs, resolvedOutputs }) {
    outputChannel.appendLine(`Running ${filename}`);
    outputChannel.appendLine(`Server: ${baseUrl}`);
    outputChannel.appendLine(`Input source: ${resolvedInputs.sourceLabel}`);
    outputChannel.appendLine(`Input cases: ${resolvedInputs.inputs.length}`);
    outputChannel.appendLine(`Expected output: ${getExpectedOutputLabel(resolvedInputs, resolvedOutputs)}`);
    outputChannel.appendLine('');
}

/**
 * Explain whether judge mode is active for the resolved testcase folder.
 * @param {{ sourceType: string }} resolvedInputs
 * @param {{ sourceLabel: string } | null | undefined} resolvedOutputs
 * @returns {string}
 */
function getExpectedOutputLabel(resolvedInputs, resolvedOutputs) {
    if (resolvedOutputs?.sourceLabel) {
        return resolvedOutputs.sourceLabel;
    }

    if (resolvedInputs.sourceType === 'empty') {
        return 'not available (no .in files found)';
    }

    return 'auto-detect skipped (missing matching .out files)';
}

/**
 * Render the output channel state while waiting for the AutoJudge result after a run is queued.
 * @param {import('vscode').OutputChannel} outputChannel 
 * @param {Object} param1 
 */
export function writeWaitingForResultOutput(outputChannel, { queueResult }) {
    outputChannel.appendLine(`Task queued: ${queueResult.id}`);
    outputChannel.appendLine('Waiting for AutoJudge result...');
    outputChannel.appendLine('');

}

/**
 * Render the queued AutoJudge result in a concise single-case or multi-case format.
 * @param {import('vscode').OutputChannel} outputChannel
 * @param {any} result
 */
export function writeResult(outputChannel, { result }) {
    if (!result?.results?.length) {
        outputChannel.appendLine('ERROR:');
        outputChannel.appendLine(result?.message || 'AutoJudge did not return any run results.');
        return;
    }

    if (result.results.length === 1) {
        writeSingleResult(outputChannel, result, result.results[0]);
        return;
    }

    const passedCount = typeof result.passed === 'number'
        ? result.passed
        : result.results.filter((entry) => entry.status === 'PASS').length;
    const failedCount = typeof result.failed === 'number'
        ? result.failed
        : Math.max(result.results.length - passedCount, 0);

    outputChannel.appendLine(failedCount === 0 ? 'OUTPUT:' : 'ERROR:');
    outputChannel.appendLine(`Cases: ${passedCount} passed, ${failedCount} failed, ${result.results.length} total`);
    outputChannel.appendLine('');

    for (const [index, entry] of result.results.entries()) {
        const label = entry.file ? path.basename(entry.file) : `Case ${index + 1}`;
        const status = entry.expected ? entry.status || inferEntryStatus(result, entry) : null;

        outputChannel.appendLine(`[${label}] ${status ? `- ${status}` : 'OUTPUT'}:`);
        writeEntryDetails(outputChannel, entry);
        outputChannel.appendLine('');
    }
}

/**
 * Render a single-case AutoJudge result while preserving the existing success/error headings.
 * @param {import('vscode').OutputChannel} outputChannel
 * @param {any} result
 * @param {any} entry
 */
function writeSingleResult(outputChannel, result, entry) {
    if (result.passed === 1 || entry.status === 'PASS') {
        outputChannel.appendLine('OUTPUT:');
        outputChannel.appendLine(entry.output || '');
        if (typeof entry.time === 'number') {
            outputChannel.appendLine('');
            outputChannel.appendLine(`Execution time: ${entry.time} ms`);
        }
        return;
    }

    outputChannel.appendLine('ERROR:');
    writeEntryDetails(outputChannel, entry);
    if (!entry.output && !entry.message && !entry.expected && !entry.received) {
        outputChannel.appendLine(result.message || 'AutoJudge run failed.');
    }
}

/**
 * Render the useful details attached to a single run result entry.
 * @param {import('vscode').OutputChannel} outputChannel
 * @param {any} entry
 */
function writeEntryDetails(outputChannel, entry) {
    if (entry.output) {
        outputChannel.appendLine(entry.output);
    }

    if (entry.message) {
        outputChannel.appendLine(entry.message);
    }

    if (entry.expected || entry.received) {
        outputChannel.appendLine(`Expected: ${entry.expected || ''}`);
        outputChannel.appendLine(`Received: ${entry.received || ''}`);
    }

    if (typeof entry.time === 'number') {
        outputChannel.appendLine(`Execution time: ${entry.time} ms`);
    }
}

/**
 * Infer a readable status when the backend omits one for coderunner responses.
 * @param {any} result
 * @param {any} entry
 * @returns {string}
 */
function inferEntryStatus(result, entry) {
    if (entry.message || result.failed > 0) {
        return 'ERROR';
    }

    return 'PASS';
}

/**
 * Build the notification text that accompanies the output-channel details.
 * @param {any} result
 * @param {{ hasExpectedOutputs: boolean }} options
 * @returns {{ severity: 'information' | 'error', message: string }}
 */
export function buildResultNotification(result, { hasExpectedOutputs }) {
    if (!result?.results?.length) {
        return {
            severity: 'error',
            message: result?.message || 'AutoJudge did not return any run results.',
        };
    }

    const passedCount = typeof result.passed === 'number'
        ? result.passed
        : result.results.filter((entry) => entry.status === 'PASS').length;
    const failedCount = typeof result.failed === 'number'
        ? result.failed
        : Math.max(result.results.length - passedCount, 0);

    // Without expected outputs the backend still reports ACCEPTED, but the user ran in code-runner mode.
    if (!hasExpectedOutputs && failedCount === 0) {
        return {
            severity: 'information',
            message: `AutoJudge: run completed for ${formatCaseCount(result.results.length)}.`,
        };
    }

    if (failedCount === 0) {
        return {
            severity: 'information',
            message: `AutoJudge: PASS. ${formatCaseCount(passedCount)} passed.`,
        };
    }

    return {
        severity: 'error',
        message: `AutoJudge: ${getVerdictLabel(result)}. ${passedCount} passed, ${failedCount} failed.`,
    };
}

/**
 * Convert a numeric case count into the small phrases used by notifications.
 * @param {number} count
 * @returns {string}
 */
function formatCaseCount(count) {
    return `${count} ${count === 1 ? 'case' : 'cases'}`;
}

/**
 * Derive a stable verdict label for notifications even when the backend omits the top-level status.
 * @param {any} result
 * @returns {string}
 */
function getVerdictLabel(result) {
    switch (result?.status) {
    case 'ACCEPTED':
        return 'PASS';
    case 'WRONG_ANSWER':
        return 'WRONG_ANSWER';
    case 'TIME_LIMIT_EXCEEDED':
        return 'TIME_LIMIT_EXCEEDED';
    case 'ERROR':
    case 'PARSING_ERROR':
        return 'ERROR';
    default:
        break;
    }

    if (result?.results?.some((entry) => entry.status === 'TLE')) {
        return 'TIME_LIMIT_EXCEEDED';
    }

    if (result?.results?.some((entry) => entry.status === 'RTE')) {
        return 'ERROR';
    }

    if (result?.results?.some((entry) => entry.status === 'WA')) {
        return 'WRONG_ANSWER';
    }

    return 'ERROR';
}