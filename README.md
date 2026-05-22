# AutoJudge VS Code Extension

Run the file you are editing against AutoJudge without leaving Visual Studio Code. AutoJudge sends your current source, optionally attaches a local input file or a folder of cases, and keeps the queue status and results inside the `AutoJudge` output channel.

## Why Use It

- Run the active file from the Command Palette, the editor title button, or `Ctrl+Alt+R`.
- Reuse local input files instead of pasting data into the browser editor.
- Send one input file, an ordered folder of input cases, or an empty input.
- Point the extension at `https://api.autojudge.io` or your own AutoJudge deployment.
- Keep run progress, outputs, and failures inside VS Code.

![Run active file preview](media/run-preview.png)

![Input path configuration preview](media/input-path-preview.png)

## Quick Start

1. Open a saved `.c`, `.cpp`, `.java`, `.js`, `.php`, or `.py` file.
2. Set `autojudge.baseUrl` if you are using a self-hosted AutoJudge API.
3. Optionally set `autojudge.inputPath` if your inputs live somewhere other than the default sidecar location.
4. Run `AutoJudge: Run Active File`.
5. Inspect the `AutoJudge` output channel for the resolved input source, queue id, and run result.

## How Input Resolution Works

AutoJudge resolves input in this order:

1. If `autojudge.inputPath` is set, the extension treats it as authoritative.
2. If the configured path points to a file, that file becomes one input case.
3. If the configured path points to a folder, each direct child file becomes one input case, sorted alphabetically.
4. If `autojudge.inputPath` is blank, the extension looks for a sibling file with the same basename as the source file and no extension.
5. If that file does not exist, the extension looks for a sibling folder with the same basename.
6. If neither exists, the extension sends one empty input string.

Configured paths can use VS Code variables such as `${workspaceFolder}`, `${workspaceFolderBasename}`, `${fileDirname}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileExtname}`, and `${pathSeparator}`.

Relative `autojudge.inputPath` values are resolved from the active source file directory. If a configured path does not exist, the run stops with a clear error instead of silently falling back.

## Examples

Default sibling file:

```text
workspace/
  solution.py
  solution
```

Default sibling folder with multiple cases:

```text
workspace/
  solution.py
  solution/
    01.in
    02.in
    03.in
```

Workspace settings example:

```json
{
  "autojudge.baseUrl": "https://api.autojudge.io",
  "autojudge.inputPath": "${workspaceFolder}/inputs/${fileBasenameNoExtension}"
}
```

Folder example with the same pattern:

```json
{
  "autojudge.inputPath": "${fileDirname}/cases/${fileBasenameNoExtension}"
}
```

## Configuration

- `autojudge.baseUrl`: Full AutoJudge API base URL. Defaults to `https://api.autojudge.io`.
- `autojudge.inputPath`: Optional file or folder path for inputs. Leave it blank to use the automatic sibling file or folder lookup.

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
- Folder inputs are non-recursive; only direct child files are sent.
- The active editor must be a saved file on disk.

## Development

1. Start the dev container with `docker compose up -d --build`.
2. Install or refresh dependencies inside the running service with `docker compose exec extension npm install`.
3. Run tests inside the container with `docker compose exec extension npm test`.
4. Open this folder in VS Code.
5. Launch an Extension Development Host and run `AutoJudge: Run Active File`.

All repository tooling should run through the `extension` service rather than the host machine.
