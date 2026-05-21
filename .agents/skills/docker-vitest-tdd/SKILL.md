---
name: docker-vitest-tdd
description: Use when refactoring or changing behavior in this repository so work follows a Vitest-first workflow executed inside the Compose development container.
---

# Docker Vitest TDD

Use this skill for feature work, bug fixes, and refactors in this repository.

## Quality Contract

- Use Vitest as the default automated test runner for repository code that can be exercised outside the VS Code Extension Development Host.
- Prefer the red-green-refactor loop: write or update the failing Vitest coverage first, implement the change, then rerun the same suite until it passes.
- Run tests through the Compose container with `docker compose exec extension npm test` or a narrower Vitest command.
- A task that changes behavior is not complete until relevant Vitest coverage exists and passes inside the container.
- If behavior depends on the Extension Development Host, keep the Vitest coverage for the pure logic and then state the manual validation still required.

## Workflow

1. Identify the smallest testable module or helper that owns the behavior.
2. Add or update the nearest Vitest file before changing production code when practical.
3. Run the smallest failing test command inside the `extension` container.
4. Implement the minimal production change.
5. Rerun the focused test, then `docker compose exec extension npm test`.
6. Document any manual validation still required for VS Code integration behavior.

## Test Placement

- Keep tests close to the code they cover when that stays readable.
- Prefer deterministic unit tests for URL normalization, payload shaping, polling flow, and input-file resolution helpers.
- Mock external services and time where needed so the suite stays fast and container-friendly.