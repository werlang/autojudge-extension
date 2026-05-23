# Manual Validation

Use this checklist when a runtime change cannot be proven with an existing automated command.

## Run Flow Smoke Test

1. Launch the extension in an Extension Development Host.
2. Open a saved, supported source file on disk.
3. Confirm both `AutoJudge: Run Active File (Code Runner)` and `AutoJudge: Test Active File` are available.
4. Confirm the editor title button is visible for supported file-backed editors and launches coderunner mode.
5. Run each command and inspect the `AutoJudge` output channel.
6. Verify the output shows the file name, configured server, explicit mode, resolved input source, case count, queue id, and final result.

## Edge Cases

1. Unsupported extension: confirm the extension shows a concise error and does not start a run.
2. Unsaved or non-file editor: confirm the extension blocks the action with a clear message.
3. Configured testcase folder: confirm a folder set through `autojudge.testcasePath` is read in alphabetical `.in` order and renders a multi-case result summary.
4. Blank `autojudge.testcasePath`: confirm the extension uses the source file directory as the testcase folder.
5. No `.in` files in the testcase folder: confirm the extension sends a single empty input string.
6. coderunner mode: confirm the extension ignores `.out` files and still runs every `.in` case.
7. Full `.in` and `.out` coverage in test mode: confirm expected outputs are sent in matching case order.
8. Missing one `.out` file in test mode: confirm the run fails before queueing and names the missing output file.
9. Missing configured testcase folder or a configured path that points to a file: confirm the run stops with a clear error.
10. Cancellation: cancel the progress notification and confirm the run stops cleanly with a cancellation message.
11. Custom base URL with a base path: confirm requests still target `/judge` and `/judge/{id}` under that base path.

## Manifest Coupling Checks

If the runtime change alters supported languages, commands, or settings, also validate the manifest and docs with the `autojudge-manifest-sync` skill.