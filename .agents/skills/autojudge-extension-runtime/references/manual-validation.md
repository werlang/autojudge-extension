# Manual Validation

Use this checklist when a runtime change cannot be proven with an existing automated command.

## Run Flow Smoke Test

1. Launch the extension in an Extension Development Host.
2. Open a saved, supported source file on disk.
3. Confirm the `AutoJudge: Run Active File` command is available.
4. Confirm the editor title button is visible for supported file-backed editors.
5. Run the command and inspect the `AutoJudge` output channel.
6. Verify the output shows the file name, configured server, resolved input source, case count, queue id, and final result.

## Edge Cases

1. Unsupported extension: confirm the extension shows a concise error and does not start a run.
2. Unsaved or non-file editor: confirm the extension blocks the action with a clear message.
3. Configured file path: confirm a file set through `autojudge.inputPath` is read and sent as one input case.
4. Configured folder path: confirm a folder set through `autojudge.inputPath` is read in alphabetical file order and renders a multi-case result summary.
5. Blank `autojudge.inputPath`: confirm the extension falls back to a sibling file without the source extension.
6. Missing sibling file with blank `autojudge.inputPath`: confirm the extension falls back to a sibling folder with the same basename.
7. Missing sibling file and folder with blank `autojudge.inputPath`: confirm the extension sends a single empty input string.
8. Missing configured path: confirm the run stops with a clear error instead of silently falling back.
9. Cancellation: cancel the progress notification and confirm the run stops cleanly with a cancellation message.
10. Custom base URL with a base path: confirm requests still target `/judge` and `/judge/{id}` under that base path.

## Manifest Coupling Checks

If the runtime change alters supported languages, commands, or settings, also validate the manifest and docs with the `autojudge-manifest-sync` skill.