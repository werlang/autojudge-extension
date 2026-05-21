---
name: docker-container-development
description: Use when a task needs repository commands or local tooling so the work runs through the Compose development container instead of the host machine.
---

# Docker Container Development

Use this skill whenever a task needs to run project tooling in this repository.

## Container Contract

- The Compose service for development commands is `extension`.
- Start or refresh the environment with `docker compose up -d --build` from the repository root.
- Run repository tooling inside the running container with `docker compose exec extension ...`.
- Do not run `node`, `npm`, `npx`, `vitest`, or other project binaries directly on the host machine.
- Prefer commands that execute from `/app`, which is the bind-mounted repository root inside the container.

## Workflow

1. Confirm the Compose environment is up before running project commands.
2. Install dependencies with `docker compose exec extension npm install` when `package.json` changed.
3. Run targeted project commands through `docker compose exec extension ...`.
4. If a command needs a shell pipeline or quoting, use `docker compose exec extension sh -lc "..."`.
5. Report the exact containerized command used for validation.

## Validation Rules

- Prefer the narrowest honest containerized command for the touched area.
- If a task changes Node-based behavior, validation must happen in the `extension` container.
- If the container is not running, bring it up instead of falling back to host execution.