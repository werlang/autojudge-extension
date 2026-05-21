# AutoJudge VS Code Extension

Run the active source file against an AutoJudge server without opening the web editor.

## Features

- Adds an `AutoJudge: Run Active File` command.
- Adds an editor title button for file-backed editors.
- Reads the active file contents and sends them to the AutoJudge `/judge` API.
- Resolves the input file by looking for a file in the same directory with the same basename and no extension.
- Prints run progress, program output, and judge errors to the `AutoJudge` output channel.

## Configuration

The extension contributes one setting:

- `autojudge.baseUrl`: Full AutoJudge API base URL. Defaults to `https://api.autojudge.io`.

Examples:

- Live API: `https://api.autojudge.io`
- LAN server: `http://192.168.1.10:3000`
- Custom base path: `https://example.com/api`

The public website lives at `https://autojudge.io`, but the deployed editor currently injects `https://api.autojudge.io` as its API base URL.

## Input Convention

If the active source file is `solution.py`, the extension expects an input file named `solution` in the same directory.

Example:

```text
workspace/
  solution.py
  solution
```

The extension sends the input file contents as a single test case, matching the current AutoJudge web editor Run flow.

## Supported Languages

- `.c`
- `.cpp`
- `.java`
- `.js`
- `.php`
- `.py`

## Limitations

- This version implements the AutoJudge Run flow only.
- Contest/problem submission is intentionally out of scope.
- The input sidecar file is required.

## Development

1. Start the dev container with `docker compose up -d --build`.
2. Install or refresh dependencies inside the running service with `docker compose exec extension npm install`.
3. Run tests inside the container with `docker compose exec extension npm test`.
4. Keep automated tests in the dedicated `tests/` folder.
5. Open this folder as a separate VS Code workspace.
6. Run the `AutoJudge: Run Active File` command from the Command Palette, or click the editor title button.
7. Inspect results in the `AutoJudge` output channel.

All repository tooling should run through the `extension` service rather than the host machine.
