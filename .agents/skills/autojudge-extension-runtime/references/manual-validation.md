# Manual Validation

Use this checklist when a runtime change cannot be proven with an existing automated command.

## Run Flow Smoke Test

1. Launch the extension in an Extension Development Host.
2. Open a saved, supported source file on disk.
3. Confirm the `AutoJudge: Run Active File` command is available.
4. Confirm the editor title button is visible for supported file-backed editors.
5. Run the command and inspect the `AutoJudge` output channel.
6. Verify the output shows the file name, configured server, resolved input sidecar path, queue id, and final result.

## Edge Cases

1. Unsupported extension: confirm the extension shows a concise error and does not start a run.
2. Unsaved or non-file editor: confirm the extension blocks the action with a clear message.
3. Missing sidecar input file: confirm the error names the missing sibling file path.
4. Cancellation: cancel the progress notification and confirm the run stops cleanly with a cancellation message.
5. Custom base URL with a base path: confirm requests still target `/judge` and `/judge/{id}` under that base path.

## Manifest Coupling Checks

If the runtime change alters supported languages, commands, or settings, also validate the manifest and docs with the `autojudge-manifest-sync` skill.