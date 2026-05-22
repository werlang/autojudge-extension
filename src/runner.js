import path from 'path';
import * as vscode from 'vscode';
import { normalizeBaseUrl, scheduleRun, pollRun } from './autojudge-client.js';
import { resolveRunInputs } from './input-resolver.js';
import { SUPPORTED_EXTENSIONS } from './config.js';
import { writePreSendOutput, writeResult, writeWaitingForResultOutput } from './output-resolver.js';

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
            progress.report({ message: 'Resolving run inputs' });
            const resolvedInputs = await resolveRunInputs(vscode, document.uri, {
                configuredInputPath: config.get('inputPath', ''),
            });

            writePreSendOutput(outputChannel, {
                filename,
                baseUrl,
                resolvedInputs,
            });

            progress.report({ message: 'Queueing run' });
            const queuedRun = await scheduleRun({
                baseUrl,
                filename,
                code: encodedSource,
                inputs: resolvedInputs.inputs,
                signal: abortController.signal,
            });

            writeWaitingForResultOutput(outputChannel, { queueResult: queuedRun });

            progress.report({ message: 'Waiting for result' });
            const result = await pollRun({
                baseUrl,
                id: queuedRun.id,
                signal: abortController.signal,
            });

            // replace result input file name by the original source file name for better output readability
            if (result?.results?.length) {
                for (const [index, entry] of result.results.entries()) {
                    if (entry.file) {
                        entry.file = path.basename(resolvedInputs.inputUris[index]?.fsPath || entry.file);
                    }
                }
            }

            writeResult(outputChannel, { result });
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

