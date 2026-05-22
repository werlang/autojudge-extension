import path from 'path';

/**
 * Expand supported VS Code variables in a configured path and resolve it on disk.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {string} configuredPath
 * @param {string} settingName
 * @returns {import('vscode').Uri}
 */
export function resolveConfiguredPathUri(vscode, sourceUri, configuredPath, settingName) {
    const expandedPath = configuredPath.replace(/\$\{([^}]+)\}/g, (match, variableName) => {
        const variableValue = getTemplateVariableValue(vscode, sourceUri, variableName);
        if (typeof variableValue !== 'string') {
            throw new Error(`Unable to resolve VS Code variable in ${settingName}: \$\{${variableName}\}`);
        }

        return variableValue;
    });

    const resolvedPath = path.isAbsolute(expandedPath)
        ? expandedPath
        : path.resolve(path.dirname(sourceUri.fsPath), expandedPath);

    return vscode.Uri.file(path.normalize(resolvedPath));
}

/**
 * Identify whether a workspace path exists as a file or directory.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} targetUri
 * @returns {Promise<'file' | 'directory' | null>}
 */
export async function getEntryType(vscode, targetUri) {
    try {
        const stat = await vscode.workspace.fs.stat(targetUri);
        if (stat.type & vscode.FileType.Directory) {
            return 'directory';
        }

        if (stat.type & vscode.FileType.File) {
            return 'file';
        }

        return null;
    }
    catch {
        return null;
    }
}

/**
 * Read a workspace file as UTF-8 text.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} fileUri
 * @returns {Promise<string>}
 */
export async function readUtf8File(vscode, fileUri) {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(bytes).toString('utf8');
}

/**
 * Resolve the subset of VS Code template variables supported by AutoJudge path settings.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {string} variableName
 * @returns {string | undefined}
 */
function getTemplateVariableValue(vscode, sourceUri, variableName) {
    const parsedPath = path.parse(sourceUri.fsPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder?.(sourceUri);
    const supportedVariables = {
        file: sourceUri.fsPath,
        fileBasename: parsedPath.base,
        fileBasenameNoExtension: parsedPath.name,
        fileBasenameWithoutExtension: parsedPath.name,
        fileDirname: parsedPath.dir,
        fileExtname: parsedPath.ext,
        pathSeparator: path.sep,
        workspaceFolder: workspaceFolder?.uri.fsPath,
        workspaceFolderBasename: workspaceFolder?.uri.fsPath ? path.basename(workspaceFolder.uri.fsPath) : undefined,
    };

    return supportedVariables[variableName];
}