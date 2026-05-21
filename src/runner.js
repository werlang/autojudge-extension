import path from 'path';
import * as vscode from 'vscode';
import { normalizeBaseUrl, scheduleRun, pollRun } from './autojudge-client.js';
import { readInputSidecar } from './input-resolver.js';
import { SUPPORTED_EXTENSIONS } from './config.js';

/**
 * Run the active source file through the AutoJudge coderunner endpoint.
 * @param {import('vscode').OutputChannel} outputChannel
 * @returns {Promise<void>}
 */
export async function runActiveFile(outputChannel) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showErrorMessage('Open a source file before running AutoJudge.');
        return;
    }

    const document = editor.document;
    if (document.isUntitled || document.uri.scheme !== 'file') {
        void vscode.window.showErrorMessage('AutoJudge only supports saved files on disk.');
        return;
    }

    const extension = path.extname(document.fileName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        void vscode.window.showErrorMessage(`Unsupported AutoJudge file extension: ${extension || '(none)'}.`);
        return;
    }

    const config = vscode.workspace.getConfiguration('autojudge');
    let baseUrl;
    try {
        baseUrl = normalizeBaseUrl(config.get('baseUrl', 'https://api.autojudge.io'));
    }
    catch (error) {
        void vscode.window.showErrorMessage(error.message);
        return;
    }

    const filename = path.basename(document.fileName);
    const sourceCode = document.getText() || ' ';
    const encodedSource = Buffer.from(sourceCode, 'utf8').toString('base64');

    outputChannel.clear();
    outputChannel.show(true);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AutoJudge: Running active file',
        cancellable: true,
    }, async (progress, cancellationToken) => {
        const abortController = new AbortController();
        const cancellationSubscription = cancellationToken.onCancellationRequested(() => abortController.abort());

        try {
            progress.report({ message: 'Resolving input sidecar file' });
            const { inputUri, input } = await readInputSidecar(vscode, document.uri);

            outputChannel.appendLine(`Running ${filename}`);
            outputChannel.appendLine(`Server: ${baseUrl}`);
            outputChannel.appendLine(`Input: ${inputUri.fsPath}`);
            outputChannel.appendLine('');

            progress.report({ message: 'Queueing run' });
            const queuedRun = await scheduleRun({
                baseUrl,
                filename,
                code: encodedSource,
                input,
                signal: abortController.signal,
            });

            outputChannel.appendLine(`Task queued: ${queuedRun.id}`);
            outputChannel.appendLine('Waiting for AutoJudge result...');
            outputChannel.appendLine('');

            progress.report({ message: 'Waiting for result' });
            const result = await pollRun({
                baseUrl,
                id: queuedRun.id,
                signal: abortController.signal,
            });

            writeResult(outputChannel, result);
        }
        catch (error) {
            const message = error.name === 'AbortError' ? 'Run cancelled.' : error.message;
            if (message === 'Run cancelled.') {
                outputChannel.appendLine(message);
                void vscode.window.showInformationMessage(message);
                return;
            }

            outputChannel.appendLine('ERROR:');
            outputChannel.appendLine(message);
            void vscode.window.showErrorMessage(message);
        }
        finally {
            cancellationSubscription.dispose();
        }
    });
}

/**
 * Render the queued AutoJudge result using the same single-run semantics as the web editor.
 * @param {import('vscode').OutputChannel} outputChannel
 * @param {any} result
 */
function writeResult(outputChannel, result) {
    if (!result?.results?.length) {
        outputChannel.appendLine('ERROR:');
        outputChannel.appendLine(result?.message || 'AutoJudge did not return any run results.');
        return;
    }

    const firstResult = result.results[0];
    if (result.passed === 1) {
        outputChannel.appendLine('OUTPUT:');
        outputChannel.appendLine(firstResult.output || '');
        outputChannel.appendLine('');
        outputChannel.appendLine(`Execution time: ${firstResult.time} ms`);
        return;
    }

    outputChannel.appendLine('ERROR:');
    outputChannel.appendLine(firstResult.message || result.message || 'AutoJudge run failed.');
}