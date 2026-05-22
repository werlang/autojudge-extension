# Changelog

## 0.1.0 (2026-05-21) - Unreleased

- Added support for testcase files with .in and .out extensions, enabling judge mode when matching pairs are present, or falling back to code-runner mode when only .in files are found.
- Added support for configurable testcase folders with `autojudge.testcasePath`, allowing users to specify a folder for input and expected output file.

## 0.0.1 (2026-05-21) - Initial testing release

- Initial AutoJudge VS Code extension scaffold.
- Added command to run the active editor file against an AutoJudge server.
