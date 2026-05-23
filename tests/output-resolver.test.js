import { describe, expect, it } from 'vitest';

import { buildResultNotification, writePreSendOutput } from '../src/output-resolver.js';

function createOutputChannel() {
    const lines = [];

    return {
        lines,
        appendLine(line) {
            lines.push(line);
        },
    };
}

describe('writePreSendOutput', () => {
    it('shows coderunner mode when expected outputs are intentionally skipped', () => {
        const outputChannel = createOutputChannel();

        writePreSendOutput(outputChannel, {
            filename: 'main.py',
            baseUrl: 'https://api.autojudge.io/',
            mode: 'coderunner',
            resolvedInputs: {
                sourceLabel: '/workspace/cases',
                inputs: ['42'],
                sourceType: 'configured-folder',
            },
            resolvedOutputs: null,
        });

        expect(outputChannel.lines).toContain('Mode: coderunner');
        expect(outputChannel.lines).toContain('Expected output: not used in coderunner mode');
    });

    it('shows the testcase folder used for expected outputs when test mode is active', () => {
        const outputChannel = createOutputChannel();

        writePreSendOutput(outputChannel, {
            filename: 'main.py',
            baseUrl: 'https://api.autojudge.io/',
            mode: 'test',
            resolvedInputs: {
                sourceLabel: '/workspace/cases',
                inputs: ['42'],
                sourceType: 'configured-folder',
            },
            resolvedOutputs: {
                sourceLabel: '/workspace/cases',
            },
        });

        expect(outputChannel.lines).toContain('Mode: test');
        expect(outputChannel.lines).toContain('Expected output: /workspace/cases');
    });

    it('shows when no .in files were found for the run', () => {
        const outputChannel = createOutputChannel();

        writePreSendOutput(outputChannel, {
            filename: 'main.py',
            baseUrl: 'https://api.autojudge.io/',
            mode: 'test',
            resolvedInputs: {
                sourceLabel: 'empty input',
                inputs: [''],
                sourceType: 'empty',
            },
            resolvedOutputs: null,
        });

        expect(outputChannel.lines).toContain('Mode: test');
        expect(outputChannel.lines).toContain('Expected output: not available (no .in files found)');
    });
});

describe('buildResultNotification', () => {
    it('builds a pass summary for test mode', () => {
        expect(buildResultNotification({
            status: 'ACCEPTED',
            passed: 2,
            failed: 0,
            results: [{ status: 'PASS' }, { status: 'PASS' }],
        }, {
            hasExpectedOutputs: true,
            mode: 'test',
        })).toEqual({
            severity: 'information',
            message: 'AutoJudge: PASS. 2 cases passed.',
        });
    });

    it('builds a wrong-answer summary for test mode failures', () => {
        expect(buildResultNotification({
            status: 'WRONG_ANSWER',
            passed: 1,
            failed: 1,
            results: [{ status: 'PASS' }, { status: 'WA' }],
        }, {
            hasExpectedOutputs: true,
            mode: 'test',
        })).toEqual({
            severity: 'error',
            message: 'AutoJudge: WRONG_ANSWER. 1 passed, 1 failed.',
        });
    });

    it('builds a run-complete summary when no expected outputs are configured', () => {
        expect(buildResultNotification({
            status: 'ACCEPTED',
            passed: 1,
            failed: 0,
            results: [{ status: 'PASS', output: '42' }],
        }, {
            hasExpectedOutputs: false,
            mode: 'coderunner',
        })).toEqual({
            severity: 'information',
            message: 'AutoJudge: coderunner completed for 1 case.',
        });
    });

    it('builds a completion summary for test mode without named testcase pairs', () => {
        expect(buildResultNotification({
            status: 'ACCEPTED',
            passed: 1,
            failed: 0,
            results: [{ status: 'PASS', output: '42' }],
        }, {
            hasExpectedOutputs: false,
            mode: 'test',
        })).toEqual({
            severity: 'information',
            message: 'AutoJudge: test run completed for 1 case.',
        });
    });

    it('falls back to an error notification when no result entries are returned', () => {
        expect(buildResultNotification({
            message: 'AutoJudge did not return any run results.',
            results: [],
        }, {
            hasExpectedOutputs: true,
            mode: 'test',
        })).toEqual({
            severity: 'error',
            message: 'AutoJudge did not return any run results.',
        });
    });
});