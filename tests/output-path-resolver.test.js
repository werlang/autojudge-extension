import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveExpectedOutputs } from '../src/output-path-resolver.js';

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

function createResolvedInputs({ sourceType, inputPaths }) {
    return {
        sourceType,
        sourceLabel: inputPaths[0] || 'empty input',
        inputUris: inputPaths.map((inputPath) => createUri(inputPath)),
        inputs: inputPaths.length ? inputPaths.map((_, index) => `case-${index + 1}`) : [''],
    };
}

describe('resolveExpectedOutputs', () => {
    it('returns null when the run falls back to empty input', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            resolvedInputs: createResolvedInputs({
                sourceType: 'empty',
                inputPaths: [],
            }),
        })).resolves.toBeNull();
    });

    it('reads matching .out files from a configured testcase folder', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/cases': [
                ['case-01.out', 1],
                ['case-02.out', 1],
                ['notes.txt', 1],
            ],
            '/workspace/fixtures/cases/case-01.out': '43\n',
            '/workspace/fixtures/cases/case-02.out': '44\n',
            '/workspace/fixtures/cases/notes.txt': 'ignore me',
        });

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${workspaceFolder}/fixtures/cases',
            resolvedInputs: createResolvedInputs({
                sourceType: 'configured-folder',
                inputPaths: [
                    '/workspace/fixtures/cases/case-01.in',
                    '/workspace/fixtures/cases/case-02.in',
                ],
            }),
        })).resolves.toMatchObject({
            sourceType: 'configured-folder',
            outputs: ['43\n', '44\n'],
            sourceLabel: '/workspace/fixtures/cases',
        });
    });

    it('reads matching .out files from the source file directory when no testcase path is configured', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions': [
                ['case-02.out', 1],
                ['case-01.out', 1],
                ['notes.txt', 1],
            ],
            '/workspace/solutions/case-01.out': 'first expected',
            '/workspace/solutions/case-02.out': 'second expected',
            '/workspace/solutions/notes.txt': 'ignore me',
        });

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '   ',
            resolvedInputs: createResolvedInputs({
                sourceType: 'default-folder',
                inputPaths: [
                    '/workspace/solutions/case-01.in',
                    '/workspace/solutions/case-02.in',
                ],
            }),
        })).resolves.toMatchObject({
            sourceType: 'default-folder',
            outputs: ['first expected', 'second expected'],
            sourceLabel: '/workspace/solutions',
        });
    });

    it('falls back to coderunner mode when some .out files are missing', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/cases': [
                ['case-01.out', 1],
            ],
            '/workspace/fixtures/cases/case-01.out': 'first expected',
        });

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${workspaceFolder}/fixtures/cases',
            resolvedInputs: createResolvedInputs({
                sourceType: 'configured-folder',
                inputPaths: [
                    '/workspace/fixtures/cases/case-01.in',
                    '/workspace/fixtures/cases/case-02.in',
                ],
            }),
        })).resolves.toBeNull();
    });

    it('fails in test mode when some .out files are missing', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/cases': [
                ['case-01.out', 1],
            ],
            '/workspace/fixtures/cases/case-01.out': 'first expected',
        });

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${workspaceFolder}/fixtures/cases',
            requireComplete: true,
            resolvedInputs: createResolvedInputs({
                sourceType: 'configured-folder',
                inputPaths: [
                    '/workspace/fixtures/cases/case-01.in',
                    '/workspace/fixtures/cases/case-02.in',
                ],
            }),
        })).rejects.toThrow('Missing expected output files: case-02.out');
    });

    it('falls back to coderunner mode when the configured testcase folder resolves to nothing', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveExpectedOutputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${fileDirname}/missing-cases',
            resolvedInputs: createResolvedInputs({
                sourceType: 'configured-folder',
                inputPaths: [
                    '/workspace/solutions/case-01.in',
                ],
            }),
        })).resolves.toBeNull();
    });
});