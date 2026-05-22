import path from 'path';

/**
 * Resolve the default input target by removing the active source file extension.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @returns {import('vscode').Uri}
 */
function getDefaultInputUri(vscode, sourceUri) {
    const parsedPath = path.parse(sourceUri.fsPath);
    return vscode.Uri.file(path.join(parsedPath.dir, parsedPath.name));
}

/**
 * Resolve the configured or implicit AutoJudge input source into ordered run inputs.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {{ configuredInputPath?: string }} [options]
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
export async function resolveRunInputs(vscode, sourceUri, { configuredInputPath } = {}) {
    const trimmedConfiguredPath = configuredInputPath?.trim() ?? '';

    if (trimmedConfiguredPath) {
        const inputUri = resolveConfiguredInputUri(vscode, sourceUri, trimmedConfiguredPath);
        const resolvedSource = await readInputSource(vscode, inputUri, {
            fileSourceType: 'configured-file',
            folderSourceType: 'configured-folder',
            missingPathError: `Configured input path not found: ${inputUri.fsPath}`,
            emptyDirectoryError: `Configured input folder has no files: ${inputUri.fsPath}`,
            emptyDirectoryResult: null,
        });

        if (resolvedSource) {
            return resolvedSource;
        }

        throw new Error(`Configured input path not found: ${inputUri.fsPath}`);
    }

    const defaultInputUri = getDefaultInputUri(vscode, sourceUri);
    const resolvedSource = await readInputSource(vscode, defaultInputUri, {
        fileSourceType: 'default-file',
        folderSourceType: 'default-folder',
        emptyDirectoryResult: getEmptyInputSource(),
    });

    if (resolvedSource) {
        return resolvedSource;
    }

    return getEmptyInputSource();
}

/**
 * Read the legacy sibling sidecar file contract as a single input string.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @returns {Promise<{ inputUri: import('vscode').Uri, input: string }>}
 */
export async function readInputSidecar(vscode, sourceUri) {
    const resolvedSource = await resolveRunInputs(vscode, sourceUri);

    if (resolvedSource.sourceType !== 'default-file' || !resolvedSource.inputUris[0]) {
        const inputUri = getDefaultInputUri(vscode, sourceUri);
        throw new Error(`Input sidecar file not found: ${inputUri.fsPath}`);
    }

    return {
        inputUri: resolvedSource.inputUris[0],
        input: resolvedSource.inputs[0],
    };
}

/**
 * Expand supported VS Code variables in the configured input path and resolve it on disk.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} sourceUri
 * @param {string} configuredInputPath
 * @returns {import('vscode').Uri}
 */
function resolveConfiguredInputUri(vscode, sourceUri, configuredInputPath) {
    const expandedInputPath = configuredInputPath.replace(/\$\{([^}]+)\}/g, (match, variableName) => {
        const variableValue = getTemplateVariableValue(vscode, sourceUri, variableName);
        if (typeof variableValue !== 'string') {
            throw new Error('Unable to resolve VS Code variable in autojudge.inputPath: ${' + variableName + '}');
        }

        return variableValue;
    });

    const resolvedPath = path.isAbsolute(expandedInputPath)
        ? expandedInputPath
        : path.resolve(path.dirname(sourceUri.fsPath), expandedInputPath);

    return vscode.Uri.file(path.normalize(resolvedPath));
}

/**
 * Resolve the subset of VS Code template variables supported by autojudge.inputPath.
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

/**
 * Read a file or directory input target into deterministic run inputs.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} inputUri
 * @param {{ fileSourceType: string, folderSourceType: string, missingPathError?: string, emptyDirectoryError?: string, emptyDirectoryResult?: { inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string } | null }} options
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string } | null>}
 */
async function readInputSource(vscode, inputUri, options) {
    const entryType = await getEntryType(vscode, inputUri);
    if (!entryType) {
        if (options.missingPathError) {
            throw new Error(options.missingPathError);
        }

        return null;
    }

    if (entryType === 'file') {
        return readInputFile(vscode, inputUri, options.fileSourceType);
    }

    const directorySource = await readInputDirectory(vscode, inputUri, options.folderSourceType);
    if (directorySource.inputs.length) {
        return directorySource;
    }

    if (options.emptyDirectoryError) {
        throw new Error(options.emptyDirectoryError);
    }

    return options.emptyDirectoryResult ?? null;
}

/**
 * Identify whether an input target exists as a file or directory.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} inputUri
 * @returns {Promise<'file' | 'directory' | null>}
 */
async function getEntryType(vscode, inputUri) {
    try {
        const stat = await vscode.workspace.fs.stat(inputUri);
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
 * Read one input file as UTF-8 text.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} inputUri
 * @param {string} sourceType
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
async function readInputFile(vscode, inputUri, sourceType) {
    const bytes = await vscode.workspace.fs.readFile(inputUri);
    return {
        inputs: [Buffer.from(bytes).toString('utf8')],
        inputUris: [inputUri],
        sourceType,
        sourceLabel: inputUri.fsPath,
    };
}

/**
 * Read direct child files from an input directory in alphabetical order.
 * @param {typeof import('vscode')} vscode
 * @param {import('vscode').Uri} directoryUri
 * @param {string} sourceType
 * @returns {Promise<{ inputs: string[], inputUris: import('vscode').Uri[], sourceType: string, sourceLabel: string }>}
 */
async function readInputDirectory(vscode, directoryUri, sourceType) {
    const entries = await vscode.workspace.fs.readDirectory(directoryUri);

    // Folder inputs become multi-case runs, so ordering must stay stable across platforms.
    const inputUris = entries
        .filter(([, entryType]) => entryType & vscode.FileType.File)
        .map(([name]) => vscode.Uri.file(path.join(directoryUri.fsPath, name)))
        .sort((leftUri, rightUri) => path.basename(leftUri.fsPath).localeCompare(path.basename(rightUri.fsPath)));

    const inputs = [];
    for (const inputUri of inputUris) {
        const bytes = await vscode.workspace.fs.readFile(inputUri);
        inputs.push(Buffer.from(bytes).toString('utf8'));
    }

    return {
        inputs,
        inputUris,
        sourceType,
        sourceLabel: directoryUri.fsPath,
    };
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