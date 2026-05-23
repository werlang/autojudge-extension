import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

function createOutputChannel() {
    const lines = [];

    return {
        lines,
        appendLine(line) {
            lines.push(line);
        },
        clear: vi.fn(),
        show: vi.fn(),
    };
}

const activeEditorState = {
    value: null,
};

const configState = {
    baseUrl: 'https://api.autojudge.io/',
    testcasePath: '',
};

const showErrorMessage = vi.fn();
const showInformationMessage = vi.fn();
const withProgress = vi.fn(async (_options, callback) => callback({
    report: vi.fn(),
}, {
    onCancellationRequested: vi.fn(() => ({
        dispose: vi.fn(),
    })),
}));

const normalizeBaseUrl = vi.fn((baseUrl) => baseUrl);
const scheduleRun = vi.fn(async () => ({ id: 'queued-run-1' }));
const pollRun = vi.fn(async () => ({
    status: 'ACCEPTED',
    passed: 1,
    failed: 0,
    results: [{
        status: 'PASS',
        output: '42',
        file: '/workspace/cases/01.in',
    }],
}));

const resolveRunInputs = vi.fn(async () => ({
    inputs: ['42'],
    inputUris: [createUri('/workspace/cases/01.in')],
    sourceType: 'configured-folder',
    sourceLabel: '/workspace/cases',
}));

const resolveExpectedOutputs = vi.fn(async () => ({
    outputs: ['42'],
    outputUris: [createUri('/workspace/cases/01.out')],
    sourceType: 'configured-folder',
    sourceLabel: '/workspace/cases',
}));

const writePreSendOutput = vi.fn();
const writeWaitingForResultOutput = vi.fn();
const writeResult = vi.fn();
const buildResultNotification = vi.fn(() => ({
    severity: 'information',
    message: 'AutoJudge: run completed for 1 case.',
}));

vi.mock('vscode', () => ({
    ProgressLocation: {
        Notification: 'notification',
    },
    window: {
        get activeTextEditor() {
            return activeEditorState.value;
        },
        showErrorMessage,
        showInformationMessage,
        withProgress,
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get(key, fallbackValue) {
                if (key === 'baseUrl') {
                    return configState.baseUrl ?? fallbackValue;
                }

                if (key === 'testcasePath') {
                    return configState.testcasePath ?? fallbackValue;
                }

                return fallbackValue;
            },
        })),
    },
}), { virtual: true });

vi.mock('../src/autojudge-client.js', () => ({
    normalizeBaseUrl,
    scheduleRun,
    pollRun,
}));

vi.mock('../src/input-resolver.js', () => ({
    resolveRunInputs,
}));

vi.mock('../src/output-path-resolver.js', () => ({
    resolveExpectedOutputs,
}));

vi.mock('../src/output-resolver.js', () => ({
    buildResultNotification,
    writePreSendOutput,
    writeResult,
    writeWaitingForResultOutput,
}));

let runner;

beforeAll(async () => {
    runner = await import('../src/runner.js');
});

beforeEach(() => {
    activeEditorState.value = {
        document: {
            isUntitled: false,
            uri: createUri('/workspace/solutions/main.py'),
            fileName: '/workspace/solutions/main.py',
            getText: () => 'print(42)',
        },
    };

    configState.baseUrl = 'https://api.autojudge.io/';
    configState.testcasePath = '';

    showErrorMessage.mockReset();
    showInformationMessage.mockReset();
    withProgress.mockClear();
    normalizeBaseUrl.mockClear();
    scheduleRun.mockClear();
    pollRun.mockClear();
    resolveRunInputs.mockClear();
    resolveExpectedOutputs.mockClear();
    writePreSendOutput.mockClear();
    writeWaitingForResultOutput.mockClear();
    writeResult.mockClear();
    buildResultNotification.mockClear();
    buildResultNotification.mockReturnValue({
        severity: 'information',
        message: 'AutoJudge: run completed for 1 case.',
    });
    resolveExpectedOutputs.mockResolvedValue({
        outputs: ['42'],
        outputUris: [createUri('/workspace/cases/01.out')],
        sourceType: 'configured-folder',
        sourceLabel: '/workspace/cases',
    });
});

describe('runner mode selection', () => {
    it('skips expected-output resolution in coderunner mode', async () => {
        const outputChannel = createOutputChannel();

        await runner.runCodeRunnerFile(outputChannel);

        expect(resolveExpectedOutputs).not.toHaveBeenCalled();
        expect(scheduleRun).toHaveBeenCalledWith(expect.objectContaining({
            inputs: ['42'],
            outputs: undefined,
        }));
    });

    it('requires complete expected outputs in test mode before queueing the run', async () => {
        const outputChannel = createOutputChannel();

        await runner.runTestFile(outputChannel);

        expect(resolveExpectedOutputs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            fsPath: '/workspace/solutions/main.py',
        }), expect.objectContaining({
            configuredTestcasePath: '',
            requireComplete: true,
        }));
        expect(scheduleRun).toHaveBeenCalledWith(expect.objectContaining({
            outputs: ['42'],
        }));
    });

    it('stops test mode before queueing when expected outputs are incomplete', async () => {
        const outputChannel = createOutputChannel();
        resolveExpectedOutputs.mockRejectedValueOnce(new Error('Missing expected output files: case-02.out'));

        await runner.runTestFile(outputChannel);

        expect(scheduleRun).not.toHaveBeenCalled();
        expect(showErrorMessage).toHaveBeenCalledWith('Missing expected output files: case-02.out');
    });
});