import path from 'path';
import { getEntryType, readUtf8File, resolveConfiguredPathUri } from './path-utils.js';

const INPUT_FILE_EXTENSION = '.in';

/**
 * Resolve the configured or implicit testcase folder into ordered run inputs.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {{ configuredTestcasePath?: string }} [options]
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
export async function resolveRunInputs(vscode, sourceUri, { configuredTestcasePath } = {}) {
    const trimmedConfiguredPath = configuredTestcasePath?.trim() ?? '';

    if (trimmedConfiguredPath) {
        const testcaseDirectoryUri = resolveConfiguredPathUri(vscode, sourceUri, trimmedConfiguredPath, 'autojudge.testcasePath');
        return readConfiguredTestcaseDirectory(vscode, testcaseDirectoryUri);
    }

    const defaultTestcaseDirectoryUri = getDefaultTestcaseDirectoryUri(vscode, sourceUri);
    return readDefaultTestcaseDirectory(vscode, defaultTestcaseDirectoryUri);
}

/**
 * Resolve the implicit testcase folder to the source file directory.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @returns {import('vscode').Uri}
 */
function getDefaultTestcaseDirectoryUri(vscode, sourceUri) {
    return vscode.Uri.file(path.dirname(sourceUri.fsPath));
}

/**
 * Read a configured testcase folder, which must exist as a directory.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
async function readConfiguredTestcaseDirectory(vscode, directoryUri) {
    const entryType = await getEntryType(vscode, directoryUri);
    if (!entryType) {
        throw new Error(`Configured testcase path not found: ${directoryUri.fsPath}`);
    }

    if (entryType !== 'directory') {
        throw new Error(`Configured testcase path must be a folder: ${directoryUri.fsPath}`);
    }

    return readTestcaseDirectory(vscode, directoryUri, 'configured-folder');
}

/**
 * Read the implicit testcase folder and fall back to one empty input when it is missing or has no `.in` files.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
async function readDefaultTestcaseDirectory(vscode, directoryUri) {
    const entryType = await getEntryType(vscode, directoryUri);
    if (entryType !== 'directory') {
        return getEmptyInputSource();
    }

    return readTestcaseDirectory(vscode, directoryUri, 'default-folder');
}

/**
 * Read direct child `.in` files from a testcase directory in alphabetical order.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @param {string} sourceType
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
async function readTestcaseDirectory(vscode, directoryUri, sourceType) {
    const inputUris = await readCaseFileUris(vscode, directoryUri, INPUT_FILE_EXTENSION);
    if (!inputUris.length) {
        return getEmptyInputSource();
    }

    const inputs = [];
    for (const inputUri of inputUris) {
        inputs.push(await readUtf8File(vscode, inputUri));
    }

    return {
        inputs,
        inputUris,
        sourceType,
        sourceLabel: directoryUri.fsPath,
    };
}

/**
 * Collect direct child testcase files for one extension while preserving stable cross-platform ordering.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @param {string} extension
 * @returns {Promise<import('vscode').Uri[]>}
 */
async function readCaseFileUris(vscode, directoryUri, extension) {
    const entries = await vscode.workspace.fs.readDirectory(directoryUri);

    // Testcase folders may contain notes or auxiliary files; only direct child case files participate in a run.
    return entries
        .filter(([name, entryType]) => entryType & vscode.FileType.File && path.extname(name).toLowerCase() === extension)
        .map(([name]) => vscode.Uri.file(path.join(directoryUri.fsPath, name)))
        .sort((leftUri, rightUri) => path.basename(leftUri.fsPath).localeCompare(path.basename(rightUri.fsPath)));
}

/**
 * Build the empty-input fallback while keeping the backend payload non-empty.
 * @returns {{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }}
 */
function getEmptyInputSource() {
    return {
        inputs: [''],
        inputUris: [],
        sourceType: 'empty',
        sourceLabel: 'empty input',
    };
}