import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveRunInputs } from '../src/input-resolver.js';

function createUri(fsPath) {
    return {
        fsPath,
        path: fsPath,
        scheme: 'file',
        with(changes) {
            return createUri(changes.path ?? fsPath);
        },
    };
}

function createWorkspaceMock(entries, workspaceFolder = '/workspace') {
    const files = new Map();
    const directories = new Set();

    for (const [entryPath, value] of Object.entries(entries)) {
        const normalizedPath = path.posix.normalize(entryPath);
        if (Array.isArray(value)) {
            directories.add(normalizedPath);
            continue;
        }

        files.set(normalizedPath, Buffer.from(value, 'utf8'));
    }

    return {
        Uri: {
            file(filePath) {
                return createUri(path.posix.normalize(filePath));
            },
        },
        FileType: {
            File: 1,
            Directory: 2,
        },
        workspace: {
            fs: {
                async stat(uri) {
                    const targetPath = path.posix.normalize(uri.fsPath);
                    if (files.has(targetPath)) {
                        return { type: 1 };
                    }

                    if (directories.has(targetPath)) {
                        return { type: 2 };
                    }

                    throw Object.assign(new Error(`Missing path: ${targetPath}`), { code: 'FileNotFound' });
                },
                async readFile(uri) {
                    const targetPath = path.posix.normalize(uri.fsPath);
                    const bytes = files.get(targetPath);
                    if (!bytes) {
                        throw Object.assign(new Error(`Missing file: ${targetPath}`), { code: 'FileNotFound' });
                    }

                    return bytes;
                },
                async readDirectory(uri) {
                    const directoryPath = path.posix.normalize(uri.fsPath);
                    const entriesInDirectory = entries[directoryPath];
                    if (!Array.isArray(entriesInDirectory)) {
                        throw Object.assign(new Error(`Missing directory: ${directoryPath}`), { code: 'FileNotFound' });
                    }

                    return entriesInDirectory;
                },
            },
            getWorkspaceFolder(uri) {
                if (!uri.fsPath.startsWith(workspaceFolder)) {
                    return undefined;
                }

                return {
                    uri: createUri(workspaceFolder),
                };
            },
        },
    };
}

describe('resolveRunInputs', () => {
    it('reads a configured input file after expanding VS Code variables', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/custom/input.txt': '42\n',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: '${workspaceFolder}/fixtures/custom/input.txt',
        })).resolves.toMatchObject({
            sourceType: 'configured-file',
            inputs: ['42\n'],
            sourceLabel: '/workspace/fixtures/custom/input.txt',
        });
    });

    it('reads configured folders as alphabetical multi-case inputs', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/cases': [
                ['case-02.txt', 1],
                ['case-01.txt', 1],
            ],
            '/workspace/fixtures/cases/case-01.txt': 'first',
            '/workspace/fixtures/cases/case-02.txt': 'second',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: '${workspaceFolder}/fixtures/cases',
        })).resolves.toMatchObject({
            sourceType: 'configured-folder',
            inputs: ['first', 'second'],
            sourceLabel: '/workspace/fixtures/cases',
        });
    });

    it('falls back to a sibling sidecar file when no setting is configured', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions/main': '7 9\n',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: '',
        })).resolves.toMatchObject({
            sourceType: 'default-file',
            inputs: ['7 9\n'],
            sourceLabel: '/workspace/solutions/main',
        });
    });

    it('falls back to a sibling sidecar folder when the default file is missing', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions/main': [
                ['02.in', 1],
                ['01.in', 1],
            ],
            '/workspace/solutions/main/01.in': 'alpha',
            '/workspace/solutions/main/02.in': 'beta',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: undefined,
        })).resolves.toMatchObject({
            sourceType: 'default-folder',
            inputs: ['alpha', 'beta'],
            sourceLabel: '/workspace/solutions/main',
        });
    });

    it('returns a single empty input when no configured or default target exists', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: '   ',
        })).resolves.toMatchObject({
            sourceType: 'empty',
            inputs: [''],
            sourceLabel: 'empty input',
        });
    });

    it('fails when a configured path resolves to nothing', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredInputPath: '${fileDirname}/missing.txt',
        })).rejects.toThrow('Configured input path not found: /workspace/solutions/missing.txt');
    });
});