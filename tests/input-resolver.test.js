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
    it('reads a configured testcase folder after expanding VS Code variables', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/custom': [
                ['case-02.in', 1],
                ['notes.txt', 1],
                ['case-01.in', 1],
            ],
            '/workspace/fixtures/custom/case-01.in': '42\n',
            '/workspace/fixtures/custom/case-02.in': '43\n',
            '/workspace/fixtures/custom/notes.txt': 'ignore me',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${workspaceFolder}/fixtures/custom',
        })).resolves.toMatchObject({
            sourceType: 'configured-folder',
            inputs: ['42\n', '43\n'],
            sourceLabel: '/workspace/fixtures/custom',
        });
    });

    it('reads configured testcase folders as alphabetical multi-case inputs', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/fixtures/cases': [
                ['case-02.in', 1],
                ['case-01.in', 1],
                ['notes.md', 1],
            ],
            '/workspace/fixtures/cases/case-01.in': 'first',
            '/workspace/fixtures/cases/case-02.in': 'second',
            '/workspace/fixtures/cases/notes.md': 'ignore me',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${workspaceFolder}/fixtures/cases',
        })).resolves.toMatchObject({
            sourceType: 'configured-folder',
            inputs: ['first', 'second'],
            sourceLabel: '/workspace/fixtures/cases',
        });
    });

    it('defaults to the source file directory when no testcase path is configured', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions': [
                ['main.py', 1],
                ['02.in', 1],
                ['readme.txt', 1],
                ['01.in', 1],
            ],
            '/workspace/solutions/01.in': '7 9\n',
            '/workspace/solutions/02.in': '1 2\n',
            '/workspace/solutions/readme.txt': 'ignore me',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '',
        })).resolves.toMatchObject({
            sourceType: 'default-folder',
            inputs: ['7 9\n', '1 2\n'],
            sourceLabel: '/workspace/solutions',
        });
    });

    it('runs once with empty input when the testcase folder has no .in files', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions': [
                ['main.py', 1],
                ['notes.txt', 1],
            ],
            '/workspace/solutions/notes.txt': 'ignore me',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: undefined,
        })).resolves.toMatchObject({
            sourceType: 'empty',
            inputs: [''],
            sourceLabel: 'empty input',
        });
    });

    it('returns a single empty input when the default testcase folder does not exist', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '   ',
        })).resolves.toMatchObject({
            sourceType: 'empty',
            inputs: [''],
            sourceLabel: 'empty input',
        });
    });

    it('fails when a configured testcase folder resolves to nothing', async () => {
        const vscode = createWorkspaceMock({});

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${fileDirname}/missing-cases',
        })).rejects.toThrow('Configured testcase path not found: /workspace/solutions/missing-cases');
    });

    it('fails when a configured testcase path resolves to a file instead of a folder', async () => {
        const vscode = createWorkspaceMock({
            '/workspace/solutions/cases.in': '42\n',
        });

        await expect(resolveRunInputs(vscode, createUri('/workspace/solutions/main.py'), {
            configuredTestcasePath: '${fileDirname}/cases.in',
        })).rejects.toThrow('Configured testcase path must be a folder: /workspace/solutions/cases.in');
    });
});