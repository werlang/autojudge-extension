---
name: autojudge-extension-runtime
description: Use when changing AutoJudge VS Code extension runtime behavior, including the run command flow, input sidecar resolution, API queue and poll logic, output channel rendering, cancellation, or AutoJudge error handling.
---

# AutoJudge Extension Runtime

Use this skill when a task changes how the extension runs code, talks to the AutoJudge API, resolves input files, or reports results to the user.

## Runtime Contract

- Keep activation thin in `src/extension.js`; put API details in `src/autojudge-client.js` and sidecar-file logic in `src/input-resolver.js`.
- Preserve the command id `autojudge.runActiveFile` unless the task explicitly requires a breaking manifest change.
- Preserve the sidecar input convention: `solution.py` reads from a sibling file named `solution` with no extension.
- Preserve the current run flow unless the task explicitly changes it: queue with `POST /judge`, then poll with `GET /judge/{id}`.
- Reuse `normalizeBaseUrl()` from `src/autojudge-client.js` for API URLs instead of rebuilding base-path logic elsewhere.
- Do not casually change the request payload shape; the backend currently expects `input: JSON.stringify([input])`.
- Keep output concise in the `AutoJudge` output channel and VS Code notifications.

## Implementation Workflow

1. Identify which file owns the behavior change before editing:
   - `src/extension.js` for command flow, progress UI, and output formatting.
   - `src/autojudge-client.js` for HTTP contract, polling, normalization, and transport errors.
   - `src/input-resolver.js` for sidecar file lookup and read behavior.
2. Make the smallest edit that fixes the root cause or adds the requested behavior.
3. If the user-facing contract changed, update docs or manifest files that describe that behavior.
4. Validate with the narrowest honest check available. This repo usually requires manual validation; use [references/manual-validation.md](references/manual-validation.md).

## Validation Rules

- Prefer a narrow executable check if one exists for the touched slice.
- When automation is absent, run a manual smoke test in the VS Code Extension Development Host.
- Verify both success output and failure or cancellation behavior when the task touches run flow or messaging.
- State any remaining validation gaps explicitly.