# AGENTS.md

## Project Scope

- This repository is a small VS Code extension that runs the active file against an AutoJudge API.
- Keep changes focused on extension behavior and agent customizations. Do not add unrelated app or backend patterns.

## Key Files

- [package.json](package.json): extension manifest, contributed commands, keybindings, menu button, and the `autojudge.baseUrl` and `autojudge.testcasePath` settings.
- [src/extension.js](src/extension.js): activation entrypoint and command registration.
- [src/runner.js](src/runner.js): explicit coderunner vs test-mode orchestration, validation, progress UI, and API run flow.
- [src/autojudge-client.js](src/autojudge-client.js): AutoJudge HTTP contract for queueing and polling runs.
- [src/input-resolver.js](src/input-resolver.js): testcase-folder expansion plus `.in` discovery and empty-input fallback.
- [src/output-path-resolver.js](src/output-path-resolver.js): `.out` discovery for test mode, including strict missing-output validation.
- [src/output-resolver.js](src/output-resolver.js): output-channel and notification messaging for explicit run modes.
- [README.md](README.md): user-facing behavior, supported languages, and testcase-folder convention.

## Project Skills

- `.agents/skills/autojudge-extension-runtime/`: use for changes to command execution, queue/poll flow, output rendering, cancellation, API calls, and input sidecar behavior.
- `.agents/skills/autojudge-manifest-sync/`: use for changes to commands, keybindings, editor title buttons, settings, supported languages, and the user-facing docs that must stay aligned with `package.json`.
- `.agents/skills/docker-container-development/`: use when a task needs any development command so Node, npm, Vitest, and other tooling run through the Compose container instead of the host machine.
- `.agents/skills/docker-vitest-tdd/`: use when refactoring or adding features so the task starts with Vitest coverage and is only complete after containerized tests pass.

## Working Conventions

- Use modern ESM-style JavaScript consistent with the existing `import` and named export pattern.
- Preserve the current extension shape: thin activation logic in [src/extension.js](src/extension.js), shared run orchestration in [src/runner.js](src/runner.js), HTTP helpers in [src/autojudge-client.js](src/autojudge-client.js), filesystem/input resolution in [src/input-resolver.js](src/input-resolver.js), and expected-output validation in [src/output-path-resolver.js](src/output-path-resolver.js).
- If you change a contributed command, menu item, keybinding, or setting, update [package.json](package.json), [README.md](README.md), and any user-facing [CHANGELOG.md](CHANGELOG.md) entry that describes the change.
- Treat all user-facing docs as extension docs, not generic app/library docs. Keep wording, examples, and workflows centered on VS Code extension usage.
- Keep [README.md](README.md) in VS Code Marketplace style. Prefer this section order unless there is a strong reason to deviate: Features, Install, Quick Start, Commands, Keyboard Shortcuts, Configuration, Troubleshooting, Release Notes.
- In [README.md](README.md), always keep command ids, command titles, keybindings, and supported languages synchronized with [package.json](package.json).
- Keep output user-facing and concise in the `AutoJudge` output channel and VS Code notifications.
- Start the development environment with `docker compose up -d --build` and run repository commands inside the running `extension` service.
- Do not run `node`, `npm`, `npx`, `vitest`, or other project tooling directly on the host; use `docker compose exec extension ...` instead.
- When a task changes behavior, add or update Vitest coverage first when practical, then make the implementation pass that coverage.
- A feature, refactor, or bug-fix task is not complete until the relevant Vitest suite passes in the Compose container and any remaining manual validation gaps are stated explicitly.

## Runtime Behavior To Preserve

- The commands are `autojudge.runActiveFile` for explicit coderunner mode and `autojudge.testActiveFile` for explicit test mode.
- The extension only supports saved on-disk files and the language extensions listed in [README.md](README.md).
- When `autojudge.testcasePath` is blank, the extension uses the active source file directory as the testcase folder.
- When `autojudge.testcasePath` is set, it must resolve to a folder and may expand VS Code variables such as `${workspaceFolder}` and `${fileDirname}`.
- Direct child `.in` files in the testcase folder are sent as inputs in alphabetical filename order.
- If the testcase folder has no `.in` files, the extension sends a single empty-string input.
- coderunner mode never looks for or sends expected outputs.
- Test mode requires every discovered `.in` file to have a matching `.out` file in the same folder and must fail clearly before the API request when any `.out` file is missing.
- The API base URL must allow optional base paths. Reuse the normalization logic in [src/autojudge-client.js](src/autojudge-client.js) instead of hand-building URLs elsewhere.
- The current run flow matches the web editor's run behavior: queue with `POST /judge`, then poll with `GET /judge/{id}` until the result is available.

## Validation

- Run automated checks through the Compose container. The default test command is `docker compose exec extension npm test`.
- For manifest-only changes, validate the manifest structure in [package.json](package.json).
- For behavior changes, favor manual validation in the VS Code Extension Development Host using both `AutoJudge: Run Active File (Code Runner)` and `AutoJudge: Test Active File`.
- Pair runtime changes with focused Vitest coverage when the touched code can be exercised outside VS Code.

## Pitfalls

- Do not assume the public site URL and API URL are the same; the extension targets the API base URL configured by `autojudge.baseUrl`.
- Do not change the input or output payload shape casually; the backend currently expects `input` as `JSON.stringify(inputs)` and test mode sends `output` as `JSON.stringify(outputs)`.
- Testcase folders are intentionally non-recursive and inputs are sent in alphabetical filename order.
- A configured `autojudge.testcasePath` is authoritative; missing configured targets and file-vs-folder mismatches should fail clearly instead of silently falling back.
- Missing `.out` files are ignored in coderunner mode but are an error in test mode.
- Do not broaden scope into contest submission flows unless explicitly requested; the repository currently implements only the Run flow.
- Do not let [README.md](README.md) drift into generic GitHub project boilerplate. It must read like a polished VS Code extension README intended for Marketplace users.