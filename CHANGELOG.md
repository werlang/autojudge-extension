# Changelog

## 0.1.0 (2026-05-24) - Test mode and configurable testcase folders

### Added

- Split the run flow into explicit coderunner and test-mode commands so users can choose between quick output checks and strict testcase validation.
- Added strict test-mode validation that stops the run when any `.in` file is missing its matching `.out` file.
- Added support for configurable testcase folders with `autojudge.testcasePath`, allowing users to specify one folder for input and expected output files.

## 0.0.1 (2026-05-21) - Initial testing release

###  Added

- Initial AutoJudge VS Code extension scaffold.
- Added command to run the active editor file against an AutoJudge server.
