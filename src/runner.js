import path from 'path';
import * as vscode from 'vscode';
import { normalizeBaseUrl, scheduleRun, pollRun } from './autojudge-client.js';
import { resolveRunInputs } from './input-resolver.js';
import { resolveExpectedOutputs } from './output-path-resolver.js';
import { SUPPORTED_EXTENSIONS, RUN_MODE } from './config.js';
import { writePreSendOutput, writeResult, writeWaitingForResultOutput } from './output-resolver.js';

/**
 * Run the active editor file against the AutoJudge API with the selected run mode, rendering output channel details and progress notifications along the way.
 * @param {import('vscode').OutputChannel} outputChannel
 * @param {typeof RUN_MODE[keyof typeof RUN_MODE]} mode
 * @returns {Promise<void>}
 */
export async function runCode(outputChannel, mode) {
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
    const configuredTestcasePath = config.get('testcasePath', '');
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
        title: mode === RUN_MODE.TEST ? 'AutoJudge: Running tests for active file' : 'AutoJudge: Running active file',
        cancellable: true,
    }, async (progress, cancellationToken) => {
        const abortController = new AbortController();
        const cancellationSubscription = cancellationToken.onCancellationRequested(() => abortController.abort());

        try {
            progress.report({ message: 'Resolving run inputs' });
            const resolvedInputs = await resolveRunInputs(vscode, document.uri, {
                configuredTestcasePath,
            });

            const resolvedOutputs = mode === RUN_MODE.TEST
                ? await resolveExpectedOutputs(vscode, document.uri, {
                    configuredTestcasePath,
                    resolvedInputs,
                })
                : null;

            writePreSendOutput(outputChannel, {
                filename,
                baseUrl,
                mode,
                resolvedInputs,
                resolvedOutputs,
            });

            progress.report({ message: 'Queueing run' });
            const queuedRun = await scheduleRun({
                baseUrl,
                filename,
                code: encodedSource,
                inputs: resolvedInputs.inputs,
                outputs: resolvedOutputs?.outputs,
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
                        // server will aanswer file input files test00, test01, etc. regardless of the original file name
                        const serverOrder = entry.file.match(/test(\d+)/)?.[1];
                        if (serverOrder != null) {
                            const inputUri = resolvedInputs.inputUris?.[Number(serverOrder)];
                            if (inputUri) {
                                entry.file = path.basename(inputUri.fsPath);
                                continue;
                            }
                        }
                    }
                }
            }

            writeResult(outputChannel, { result, mode });
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

