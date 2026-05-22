import path from 'path';

/**
 * Render the details of an AutoJudge run result in the output channel before the run is sent, after it is queued, and when results are received.
 * @param {import('vscode').OutputChannel} outputChannel 
 * @param {Object} param1 
 */
export function writePreSendOutput(outputChannel, { filename, baseUrl, resolvedInputs }) {
    outputChannel.appendLine(`Running ${filename}`);
    outputChannel.appendLine(`Server: ${baseUrl}`);
    outputChannel.appendLine(`Input source: ${resolvedInputs.sourceLabel}`);
    outputChannel.appendLine(`Input cases: ${resolvedInputs.inputs.length}`);
    outputChannel.appendLine('');
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