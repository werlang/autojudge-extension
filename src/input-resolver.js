import path from 'path';

/**
 * Resolve the input sidecar file by removing the active source file extension.
 * @param {import('vscode').Uri} sourceUri
 * @returns {import('vscode').Uri}
 */
function getInputUri(sourceUri) {
    const parsedPath = path.parse(sourceUri.fsPath);
    return sourceUri.with({
        path: path.posix.join(path.posix.dirname(sourceUri.path), parsedPath.name),
    });
}

/**
 * Load the input sidecar file as UTF-8 text.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @returns {Promise<{ inputUri: import('vscode').Uri, input: string }>}
 */
export async function readInputSidecar(vscode, sourceUri) {
    const inputUri = getInputUri(sourceUri);

    try {
        const bytes = await vscode.workspace.fs.readFile(inputUri);
        const input = Buffer.from(bytes).toString('utf8');
        return { inputUri, input };
    }
    catch (error) {
        throw new Error(`Input sidecar file not found: ${inputUri.fsPath}`);
    }
}