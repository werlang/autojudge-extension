---
name: autojudge-extension-runtime
description: Use when changing AutoJudge VS Code extension runtime behavior, including the run command flow, input sidecar resolution, API queue and poll logic, output channel rendering, cancellation, or AutoJudge error handling.
---

# AutoJudge Extension Runtime

Use this skill when a task changes how the extension runs code, talks to the AutoJudge API, resolves input or expected-output files, or reports results to the user.

## Runtime Contract

- Keep activation thin in `src/extension.js`; put API details in `src/autojudge-client.js`, testcase resolution in `src/input-resolver.js`, and expected-output discovery in `src/output-path-resolver.js`.
- Preserve the explicit mode split: `autojudge.runActiveFile` is coderunner mode and `autojudge.testActiveFile` is test mode unless the task explicitly changes the manifest surface again.
- Preserve the default testcase-folder behavior when `autojudge.testcasePath` is blank: use the source file directory, resolve direct child `.in` files in alphabetical order, and fall back to a single empty-string input when none exist.
- Preserve the configured testcase-path behavior: a non-empty `autojudge.testcasePath` must resolve to a folder, can use VS Code variables, and should fail clearly when it resolves to nothing or to a file.
- Preserve explicit mode behavior: coderunner mode never resolves expected outputs, and test mode only sends expected outputs when every discovered `.in` file has a matching `.out` file in the same testcase folder.
- Preserve strict test-mode validation: missing `.out` files must stop the run before the API request with a clear error.
- Preserve the current run flow unless the task explicitly changes it: queue with `POST /judge`, then poll with `GET /judge/{id}`.
- Reuse `normalizeBaseUrl()` from `src/autojudge-client.js` for API URLs instead of rebuilding base-path logic elsewhere.
- Do not casually change the request payload shape; the backend currently expects `input: JSON.stringify(inputs)` where `inputs` is an ordered array of case strings, and test mode sends `output: JSON.stringify(outputs)` with the same case ordering.
- Keep output concise in the `AutoJudge` output channel and VS Code notifications.

## Implementation Workflow

1. Identify which file owns the behavior change before editing:
   - `src/extension.js` for command registration and activation.
   - `src/runner.js` for explicit mode routing, progress UI, and shared run orchestration.
   - `src/autojudge-client.js` for HTTP contract, polling, normalization, and transport errors.
   - `src/input-resolver.js` for configured testcase folders, `.in` discovery, and empty-input behavior.
   - `src/output-path-resolver.js` for `.out` discovery and strict test-mode completeness validation.
2. Make the smallest edit that fixes the root cause or adds the requested behavior.
3. If the user-facing contract changed, update docs or manifest files that describe that behavior.
4. Validate with the narrowest honest check available. This repo usually requires manual validation; use [references/manual-validation.md](references/manual-validation.md).

## Validation Rules

- Prefer a narrow executable check if one exists for the touched slice.
- When automation is absent, run a manual smoke test in the VS Code Extension Development Host.
- Verify both success output and failure or cancellation behavior when the task touches run flow or messaging.
- When testcase resolution changes, verify configured folder paths, blank-setting defaulting to the source file directory, `.in` discovery, empty-input fallback, coderunner mode ignoring `.out` files, and test mode failing clearly when `.out` coverage is incomplete.
- State any remaining validation gaps explicitly.