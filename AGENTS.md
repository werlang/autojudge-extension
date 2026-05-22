# AGENTS.md

## Project Scope

- This repository is a small VS Code extension that runs the active file against an AutoJudge API.
- Keep changes focused on extension behavior and agent customizations. Do not add unrelated app or backend patterns.

## Key Files

- [package.json](package.json): extension manifest, contributed command, keybinding, menu button, and the `autojudge.baseUrl` and `autojudge.inputPath` settings.
- [src/extension.js](src/extension.js): activation entrypoint, command registration, validation, progress UI, and output rendering.
- [src/autojudge-client.js](src/autojudge-client.js): AutoJudge HTTP contract for queueing and polling runs.
- [src/input-resolver.js](src/input-resolver.js): configured input-path expansion plus sibling file or folder fallback.
- [README.md](README.md): user-facing behavior, supported languages, and input-file convention.

## Project Skills

- `.agents/skills/autojudge-extension-runtime/`: use for changes to command execution, queue/poll flow, output rendering, cancellation, API calls, and input sidecar behavior.
- `.agents/skills/autojudge-manifest-sync/`: use for changes to commands, keybindings, editor title buttons, settings, supported languages, and the user-facing docs that must stay aligned with `package.json`.
- `.agents/skills/docker-container-development/`: use when a task needs any development command so Node, npm, Vitest, and other tooling run through the Compose container instead of the host machine.
- `.agents/skills/docker-vitest-tdd/`: use when refactoring or adding features so the task starts with Vitest coverage and is only complete after containerized tests pass.

## Working Conventions

- Use modern ESM-style JavaScript consistent with the existing `import` and named export pattern.
- Preserve the current extension shape: thin activation logic in [src/extension.js](src/extension.js), HTTP helpers in [src/autojudge-client.js](src/autojudge-client.js), filesystem/input resolution in [src/input-resolver.js](src/input-resolver.js).
- If you change a contributed command, menu item, keybinding, or setting, update [package.json](package.json), [README.md](README.md), and any user-facing [CHANGELOG.md](CHANGELOG.md) entry that describes the change.
- Keep output user-facing and concise in the `AutoJudge` output channel and VS Code notifications.
- Start the development environment with `docker compose up -d --build` and run repository commands inside the running `extension` service.
- Do not run `node`, `npm`, `npx`, `vitest`, or other project tooling directly on the host; use `docker compose exec extension ...` instead.
- When a task changes behavior, add or update Vitest coverage first when practical, then make the implementation pass that coverage.
- A feature, refactor, or bug-fix task is not complete until the relevant Vitest suite passes in the Compose container and any remaining manual validation gaps are stated explicitly.

## Runtime Behavior To Preserve

- The command is `autojudge.runActiveFile`.
- The extension only supports saved on-disk files and the language extensions listed in [README.md](README.md).
- When `autojudge.inputPath` is blank, the extension falls back from a sibling file named like the source without its extension, to a sibling folder with that name, to a single empty-string input.
- When `autojudge.inputPath` is set, it may resolve to a file or folder and may expand VS Code variables such as `${workspaceFolder}` and `${fileDirname}`.
- The API base URL must allow optional base paths. Reuse the normalization logic in [src/autojudge-client.js](src/autojudge-client.js) instead of hand-building URLs elsewhere.
- The current run flow matches the web editor's run behavior: queue with `POST /judge`, then poll `GET /judge/{id}` until the result is available.

## Validation

- Run automated checks through the Compose container. The default test command is `docker compose exec extension npm test`.
- For manifest-only changes, validate the manifest structure in [package.json](package.json).
- For behavior changes, favor manual validation in the VS Code Extension Development Host using the `AutoJudge: Run Active File` command.
- Pair runtime changes with focused Vitest coverage when the touched code can be exercised outside VS Code.

## Pitfalls

- Do not assume the public site URL and API URL are the same; the extension targets the API base URL configured by `autojudge.baseUrl`.
- Do not change the input payload shape casually; the backend currently expects `input` as `JSON.stringify(inputs)` where `inputs` is an ordered array of case strings.
- Folder inputs are intentionally non-recursive and are sent in alphabetical filename order.
- A configured `autojudge.inputPath` is authoritative; missing configured targets should fail clearly instead of silently falling back.
- Do not broaden scope into contest submission flows unless explicitly requested; the repository currently implements only the Run flow.