import path from 'path';
import { getEntryType, readUtf8File, resolveConfiguredPathUri } from './path-utils.js';

const INPUT_FILE_EXTENSION = '.in';
const OUTPUT_FILE_EXTENSION = '.out';

/**
 * Resolve expected outputs from the testcase folder so the backend can run in explicit test mode.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {{ configuredTestcasePath?: string, resolvedInputs: { inputUris: import('vscode').Uri[], sourceType: string } }} options
 * @returns {Promise<{ outputs: string[], outputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string } | null>}
 */
export async function resolveExpectedOutputs(vscode, sourceUri, { configuredTestcasePath, resolvedInputs }) {
    if (!resolvedInputs || resolvedInputs.sourceType === 'empty') {
        return null;
    }

    const testcaseDirectoryUri = resolveTestcaseDirectoryUri(vscode, sourceUri, configuredTestcasePath);
    const entryType = await getEntryType(vscode, testcaseDirectoryUri);
    if (entryType !== 'directory') {
        return null;
    }

    const resolvedOutputDirectory = await readExpectedOutputDirectory(vscode, testcaseDirectoryUri, resolvedInputs.inputUris);
    if (!resolvedOutputDirectory) {
        return null;
    }

    return {
        outputs: resolvedOutputDirectory.outputs,
        outputUris: resolvedOutputDirectory.outputUris,
        sourceType: testcaseDirectoryUri.fsPath === path.dirname(sourceUri.fsPath) && !(configuredTestcasePath?.trim())
            ? 'default-folder'
            : 'configured-folder',
        sourceLabel: testcaseDirectoryUri.fsPath,
    };
}

/**
 * Resolve the testcase directory from the configured path or the source file directory.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {string | undefined} configuredTestcasePath
 * @returns {import('vscode').Uri}
 */
function resolveTestcaseDirectoryUri(vscode, sourceUri, configuredTestcasePath) {
    const trimmedConfiguredPath = configuredTestcasePath?.trim() ?? '';
    if (trimmedConfiguredPath) {
        return resolveConfiguredPathUri(vscode, sourceUri, trimmedConfiguredPath, 'autojudge.testcasePath');
    }

    return vscode.Uri.file(path.dirname(sourceUri.fsPath));
}

/**
 * Read expected outputs in the same order as the resolved input cases.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @param {import('vscode').Uri[]} inputUris
 * @returns {Promise<{ outputs: string[], outputUris: import('vscode').Uri[] } | null>}
 */
async function readExpectedOutputDirectory(vscode, directoryUri, inputUris) {
    const outputs = [];
    const outputUris = [];
    const missingOutputFiles = [];

    // Test mode and coderunner mode share the same folder scan, but only test mode turns missing `.out` files into a hard stop.
    for (const inputUri of inputUris) {
        const outputFilename = replaceCaseFileExtension(path.basename(inputUri.fsPath), INPUT_FILE_EXTENSION, OUTPUT_FILE_EXTENSION);
        const outputUri = vscode.Uri.file(path.join(directoryUri.fsPath, outputFilename));
        const entryType = await getEntryType(vscode, outputUri);
        if (entryType !== 'file') {
            missingOutputFiles.push(outputFilename);
            continue;
        }

        outputs.push(await readUtf8File(vscode, outputUri));
        outputUris.push(outputUri);
    }

    if (missingOutputFiles.length) {
        throw new Error(`Missing expected output files: ${missingOutputFiles.join(', ')}`);
    }

    return {
        outputs,
        outputUris,
    };
}

/**
 * Swap a testcase file extension while keeping unmatched names stable.
 * @param {string} filename
 * @param {string} inputExtension
 * @param {string} outputExtension
 * @returns {string}
 */
function replaceCaseFileExtension(filename, inputExtension, outputExtension) {
    if (!filename.toLowerCase().endsWith(inputExtension)) {
        return filename;
    }

    return `${filename.slice(0, -inputExtension.length)}${outputExtension}`;
}