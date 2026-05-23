---
name: autojudge-manifest-sync
description: Use when changing the VS Code extension manifest surface for AutoJudge, including commands, keybindings, menus, settings, supported languages, or user-facing documentation that must stay synchronized with package.json.
---

# AutoJudge Manifest Sync

Use this skill when a task changes anything exposed through `package.json` or described to users in `README.md`.

## Sync Contract

- Keep the command ids, titles, keybindings, menu entries, and setting definitions in `package.json` aligned with the docs in `README.md`.
- Keep `README.md` written as a VS Code extension README (Marketplace-oriented), not as a generic GitHub project README.
- Keep `README.md` focused on extension usage: install, commands, shortcuts, settings, and troubleshooting before development internals.
- Prefer this section order in `README.md`: Features, Install, Quick Start, Commands, Keyboard Shortcuts, Configuration, Troubleshooting, Release Notes.
- If supported languages change, update both manifest gating expressions and the supported-language list in `README.md`.
- If a setting changes, update both the contributed setting metadata in `package.json` and the configuration and examples in `README.md`.
- When `autojudge.testcasePath` changes, keep the README examples truthful for source-folder defaults, configured testcase folders, `.in` and `.out` naming, coderunner mode ignoring expected outputs, and test mode requiring complete testcase pairs.
- If a user-visible feature changes materially, add a concise entry to `CHANGELOG.md`.
- If README marketing copy or screenshots depend on that feature, keep those assets truthful as well.
- Do not document contest submission flows or other out-of-scope features that the extension does not implement.

## Workflow

1. Start from the manifest field that controls the behavior: `commands`, `keybindings`, `menus`, or `configuration`.
2. Make the manifest change in `package.json`.
3. Immediately update `README.md` so examples, supported languages, screenshots, command descriptions, and behavior text stay truthful and extension-focused.
4. Update `CHANGELOG.md` when the change affects end users.
5. If the manifest change also affects runtime behavior, validate the paired runtime path with the `autojudge-extension-runtime` skill.

## Validation Rules

- Validate that `package.json` remains valid JSON.
- Re-check any `when` clauses or language regexes you touched.
- In the Extension Development Host, confirm the command or button appears only where intended.
- Report every file that was intentionally kept in sync.