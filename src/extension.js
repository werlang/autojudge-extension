import * as vscode from 'vscode';
import { runActiveFile } from './runner.js';

/**
 * Activate the AutoJudge extension and register the Run command.
 * @param {import('vscode').ExtensionContext} context
 */
export function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('AutoJudge');

    const runCommand = vscode.commands.registerCommand('autojudge.runActiveFile', async () => {
        await runActiveFile(outputChannel);
    });

    context.subscriptions.push(outputChannel, runCommand);
}

/**
 * Deactivate the extension.
 */
export function deactivate() {}
