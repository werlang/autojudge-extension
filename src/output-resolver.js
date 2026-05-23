import path from 'path';
import { RUN_MODE } from './config.js';

/**
 * Render the details of an AutoJudge run result in the output channel before the run is sent, after it is queued, and when results are received.
 * @param {import('vscode').OutputChannel} outputChannel 
 * @param {{ filename: string, baseUrl: string, mode?: typeof RUN_MODE[keyof typeof RUN_MODE], resolvedInputs: { sourceLabel: string, inputs: string[] }, resolvedOutputs?: { sourceLabel: string } | null }} param1 
 */
export function writePreSendOutput(outputChannel, { filename, baseUrl, mode = RUN_MODE.CODE_RUNNER, resolvedInputs, resolvedOutputs }) {
    outputChannel.appendLine(`Running ${filename}`);
    outputChannel.appendLine(`Server: ${baseUrl}`);
    outputChannel.appendLine(`Mode: ${mode}`);
    outputChannel.appendLine(`Input source: ${resolvedInputs.sourceLabel}`);
    outputChannel.appendLine(`Input cases: ${resolvedInputs.inputs.length}`);
    if (mode === RUN_MODE.TEST) {
        outputChannel.appendLine(`Expected output: ${getExpectedOutputLabel(mode, resolvedInputs, resolvedOutputs)}`);
    }
    outputChannel.appendLine('');
}

/**
 * Explain how the explicit run mode will use expected outputs.
 * @param {typeof RUN_MODE[keyof typeof RUN_MODE]} mode
 * @param {{ sourceType: string }} resolvedInputs
 * @param {{ sourceLabel: string } | null | undefined} resolvedOutputs
 * @returns {string}
 */
function getExpectedOutputLabel(mode, resolvedInputs, resolvedOutputs) {
    if (mode === RUN_MODE.CODE_RUNNER) {
        return 'not used in coderunner mode';
    }

    if (resolvedOutputs?.sourceLabel) {
        return resolvedOutputs.sourceLabel;
    }

    if (resolvedInputs.sourceType === 'empty') {
        return 'not available (no .in files found)';
    }

    return 'required in test mode';
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
export function writeResult(outputChannel, { result, mode = RUN_MODE.CODE_RUNNER }) {
    if (!result?.results?.length) {
        outputChannel.appendLine('ERROR:');
        outputChannel.appendLine(result?.message || 'AutoJudge did not return any run results.');
        return;
    }

    const passedCount = typeof result.passed === 'number'
        ? result.passed
        : result.results.filter((entry) => entry.status === 'PASS').length;
    const failedCount = typeof result.failed === 'number'
        ? result.failed
        : Math.max(result.results.length - passedCount, 0);

    outputChannel.appendLine(mode === RUN_MODE.CODE_RUNNER ? 'OUTPUT:' : 'RESULTS:');
    outputChannel.appendLine('');

    for (const [index, entry] of result.results.entries()) {
        console.log(entry);
        const label = entry.file ? path.basename(entry.file) : `Case ${index + 1}`;

        outputChannel.appendLine(`[${label}]${mode === RUN_MODE.CODE_RUNNER ? ':' : ` - ${getVerdictLabel(entry.status)}`}`);
        writeEntryDetails(outputChannel, entry);
        outputChannel.appendLine('');
    }

    if (mode === RUN_MODE.TEST) {
        outputChannel.appendLine(`Cases: ${passedCount} passed, ${failedCount} failed, ${result.results.length} total`);
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
 * Derive a stable verdict label for notifications even when the backend omits the top-level status.
 * @param {any} result
 * @returns {string}
 */
function getVerdictLabel(result) {
    const statusEnum = {
        PASS: 'PASS',
        WA: 'WRONG_ANSWER',
        TLE: 'TIME_LIMIT_EXCEEDED',
        RTE: 'ERROR',
    }
    return statusEnum[result] || result || 'UNKNOWN';
}

/**
 * Convert a numeric case count into the small phrases used by notifications.
 * @param {number} count
 * @returns {string}
 */
function formatCaseCount(count) {
    return `${count} ${count === 1 ? 'case' : 'cases'}`;
}