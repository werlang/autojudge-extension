# AutoJudge VS Code Extension

Run or test the file you are editing against AutoJudge without leaving Visual Studio Code. Use coderunner mode for quick output checks, or switch to test mode when you want strict validation against local `.in` and `.out` testcase pairs.

## Why Use It

- Choose the right command for the job: coderunner mode for quick feedback, test mode for strict expected-output validation.
- Reuse local testcase folders instead of pasting data into the browser editor.
- Send every direct child `.in` file from one folder in stable alphabetical order.
- Fail early in test mode when a testcase pair is incomplete, so you know exactly what is missing.
- Point the extension at `https://api.autojudge.io` or your own AutoJudge deployment.
- Keep progress, outputs, verdicts, and failures inside VS Code.

![Run active file preview](media/run-preview.png)

## Quick Start

1. Open a saved `.c`, `.cpp`, `.java`, `.js`, `.php`, or `.py` file.
2. Set `autojudge.baseUrl` if you are using a self-hosted AutoJudge API.
3. Optionally set `autojudge.testcasePath` if your testcase files live somewhere other than the source file directory.
4. Put your testcase files in one folder.
5. Choose one command:
  - `AutoJudge: Run Active File (Code Runner)` or `Ctrl+Alt+R` for quick output and debugging.
  - `AutoJudge: Test Active File` or `Ctrl+Alt+Shift+R` for strict `.in`/`.out` validation.
6. Inspect the `AutoJudge` output channel and result notification for the resolved testcase folder, queue id, and final result.

The editor title button runs coderunner mode. Test mode is available from the Command Palette and its dedicated shortcut.

## How Testcase Resolution Works

AutoJudge uses one testcase folder for both run modes:

1. If `autojudge.testcasePath` is set, the extension treats it as the testcase folder.
2. If `autojudge.testcasePath` is blank, the extension uses the active source file directory.
3. Every direct child `.in` file in that folder becomes one input case.
4. Input cases are sorted alphabetically by filename so multi-case runs stay stable across platforms.
5. If the folder has no `.in` files, AutoJudge sends one empty input string.

Configured testcase paths can use VS Code variables such as `${workspaceFolder}`, `${workspaceFolderBasename}`, `${fileDirname}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileExtname}`, and `${pathSeparator}`.

Relative `autojudge.testcasePath` values are resolved from the active source file directory. If a configured testcase path does not exist or points to a file instead of a folder, the run stops with a clear error.

## coderunner Mode

coderunner mode is the fast path for trying input files and reading program output:

1. AutoJudge reads all direct child `.in` files in the testcase folder and sends them in alphabetical order.
2. If the folder has no `.in` files, AutoJudge sends one empty input string.
3. `.out` files are ignored completely in this mode.
4. The output channel shows the resolved testcase folder, queue id, and program output for each case.

Use this mode when you want quick feedback or when you have inputs ready but do not want to maintain expected-output files yet.

## Test Mode

Test mode uses the same testcase folder, but it treats `.out` files as required validation data:

1. AutoJudge reads the `.in` files exactly the same way as coderunner mode.
2. For every discovered `.in` file, the extension requires a direct child `.out` file with the same basename in the same folder.
3. If one or more `.out` files are missing, the run stops before the API request and the error names the missing output files.
4. If every testcase pair is present, AutoJudge sends both inputs and expected outputs to the API and reports the final verdict in VS Code.
5. If the folder has no `.in` files, AutoJudge still sends one empty input; there are no testcase pairs to validate in that case.

When testcase pairs are present, the backend uses the same comparison strategy as the AutoJudge editor so wrong answers include concise expected-versus-received details in the output channel.

## Examples

coderunner mode from the source file directory:

```text
workspace/
  solution.py
  01.in
  02.in
```

Test mode with full testcase pairs:

```text
workspace/
  solution.py
  01.in
  01.out
  02.in
  02.out
```

Workspace settings example:

```json
{
  "autojudge.baseUrl": "https://api.autojudge.io",
  "autojudge.testcasePath": "${workspaceFolder}/cases/${fileBasenameNoExtension}"
}
```

Configured testcase folder example:

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

    In that setup, `01.in` and `02.in` are used as inputs, `01.out` and `02.out` enable test mode validation, and `notes.txt` is ignored.

    Incomplete testcase pairs fail in test mode:

```text
workspace/
  solution.py
  cases/
    solution/
      01.in
      01.out
      02.in
```

  In that setup, `AutoJudge: Test Active File` stops immediately with an error for `02.out`. `AutoJudge: Run Active File (Code Runner)` still runs both inputs because it does not use expected outputs.

## Configuration

- `autojudge.baseUrl`: Full AutoJudge API base URL. Defaults to `https://api.autojudge.io`.
- `autojudge.testcasePath`: Optional testcase folder path shared by coderunner mode and test mode. Leave it blank to use the source file directory.

Base URL examples:

- Hosted API: `https://api.autojudge.io`
- Local network server: `http://192.168.1.10:3000`
- Custom base path: `https://example.com/api`

The public website lives at `https://autojudge.io`, but this extension targets the API URL configured in `autojudge.baseUrl`.

## Supported Languages

- `.c`
- `.cpp`
- `.java`
- `.js`
- `.php`
- `.py`

## Limitations

- This extension implements the AutoJudge Run flow only.
- Contest and problem submission flows are intentionally out of scope.
- Testcase folders are non-recursive; only direct child files are used.
- Test mode requires one `.out` file for every `.in` file in the testcase folder.
- The active editor must be a saved file on disk.

## Development

1. Start the dev container with `docker compose up -d --build`.
2. Install or refresh dependencies inside the running service with `docker compose exec extension npm install`.
3. Run tests inside the container with `docker compose exec extension npm test`.
4. Open this folder in VS Code.
5. Launch an Extension Development Host and run `AutoJudge: Run Active File (Code Runner)` or `AutoJudge: Test Active File`.

All repository tooling should run through the `extension` service rather than the host machine.
