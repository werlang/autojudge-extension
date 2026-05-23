# AutoJudge

Run and test competitive programming files directly from VS Code against the AutoJudge API.

Use Code Runner mode for fast output checks, or Test mode for strict `.in`/`.out` validation.

![Run active file preview](media/run-preview.png)

## Features

- Run the active file without leaving the editor.
- Test with local testcase pairs from a single folder.
- Send direct child `.in` files in stable alphabetical order.
- Fail early in Test mode when expected `.out` files are missing.
- Keep queue id, output, verdicts, and errors in the `AutoJudge` output channel.
- Connect to `https://api.autojudge.io` or your own self-hosted AutoJudge API.

## Install

Install from the VS Code Marketplace, or run:

```bash
ext install autojudge.autojudge-extension
```

## Quick Start

1. Open a saved source file (`.c`, `.cpp`, `.java`, `.js`, `.ts`, `.php`, or `.py`).
2. Optionally set `autojudge.baseUrl` if you use a custom API host.
3. Optionally set `autojudge.testcasePath` if testcases are not in the source file directory.
4. Run one command:
   - `AutoJudge: Run Active File (Code Runner)`
   - `AutoJudge: Test Active File (Test Mode)`
5. Check the `AutoJudge` output channel for folder resolution, queue id, outputs, and final status.

## Commands

- `AutoJudge: Run Active File (Code Runner)`
  - Command id: `autojudge.runActiveFile`
  - Purpose: Fast run path, ignores `.out` files.
- `AutoJudge: Test Active File (Test Mode)`
  - Command id: `autojudge.testActiveFile`
  - Purpose: Strict run path, requires matching `.out` files for discovered `.in` files.

Both commands are available from the Command Palette and from the editor title when a supported saved file is active.

## Keyboard Shortcuts

- `Ctrl+Alt+R`: Run Active File (Code Runner)
- `Ctrl+Alt+T`: Test Active File (Test Mode)

## Configuration

- `autojudge.baseUrl`
  - Full AutoJudge API base URL.
  - Default: `https://api.autojudge.io`
- `autojudge.testcasePath`
  - Optional testcase folder shared by both modes.
  - Supports VS Code variables such as `${workspaceFolder}` and `${fileDirname}`.
  - Leave blank to use the active source file directory.

Example:

```json
{
  "autojudge.baseUrl": "https://api.autojudge.io",
  "autojudge.testcasePath": "${workspaceFolder}/cases/${fileBasenameNoExtension}"
}
```

## How Testcases Are Resolved

1. If `autojudge.testcasePath` is set, that folder is used.
2. If `autojudge.testcasePath` is empty, the active source file directory is used.
3. AutoJudge scans only direct child `.in` files (non-recursive).
4. Inputs are sorted alphabetically by filename.
5. If no `.in` files exist, one empty input string is sent.

If a configured testcase path does not exist or points to a file, the run stops with a clear error.

## Mode Behavior

### Code Runner Mode

- Sends discovered inputs only.
- Ignores `.out` files completely.
- Best for quick feedback and debugging.

### Test Mode

- Uses the same input resolution as Code Runner mode.
- Requires a matching `.out` file for each discovered `.in` file.
- Stops before queueing if one or more `.out` files are missing.
- Sends both inputs and expected outputs when all pairs are present.

## Folder Examples

Code Runner/Test inputs:

```text
workspace/
  solution.py
  01.in
  02.in
```

Complete testcase pairs for Test mode:

```text
workspace/
  solution.py
  01.in
  01.out
  02.in
  02.out
```

Configured testcase folder:

```text
workspace/
  solution.py
  cases/
    solution/
      01.in
      01.out
      02.in
      02.out
      notes.txt
```

Incomplete pairs (Test mode fails, Code Runner still runs):

```text
workspace/
  solution.py
  cases/
    solution/
      01.in
      01.out
      02.in
```

## Supported Languages

- `.c`
- `.cpp`
- `.java`
- `.js`
- `.ts`
- `.php`
- `.py`

## Requirements and Limits

- Active editor must be a saved on-disk file.
- Only direct child testcase files are read (no recursion).
- This extension implements the AutoJudge Run flow only.
- Contest/problem submission flows are out of scope.

## Troubleshooting

- Ensure `autojudge.baseUrl` points to an API endpoint (not the web app).
- If Test mode fails immediately, verify every `.in` has a same-name `.out` file.
- If no `.in` files exist, AutoJudge sends one empty input by design.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Development

1. Start the container: `docker compose up -d --build`
2. Install dependencies: `docker compose exec extension npm install`
3. Run tests: `docker compose exec extension npm test`

All repository tooling should run through the `extension` service.
