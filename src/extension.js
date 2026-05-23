import * as vscode from 'vscode';
import { runCode } from './runner.js';
import { RUN_MODE } from './config.js';

/**
 * Activate the AutoJudge extension and register the explicit run-mode commands.
 * @param {import('vscode').ExtensionContext} context
 */
export function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('AutoJudge');

    const runCommand = vscode.commands.registerCommand('autojudge.runActiveFile', async () => {
        await runCode(outputChannel, RUN_MODE.CODE_RUNNER);
    });

    const testCommand = vscode.commands.registerCommand('autojudge.testActiveFile', async () => {
        await runCode(outputChannel, RUN_MODE.TEST);
    });

    context.subscriptions.push(outputChannel, runCommand, testCommand);
}

/**
 * Deactivate the extension.
 */
export function deactivate() {}
