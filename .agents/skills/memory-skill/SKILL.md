---
name: memory
description: Human-like long-term memory across sessions. Start every task with memory_search unless the user opts out, search again whenever context is missing, write at least one durable memory per substantive task with memory_write, and use memory_forget to prune stale, duplicate, contradicted, or low-value entries so active memory stays small and relevant.
---

# Memory Skill

## Overview

- Provide three functions: `memory_search`, `memory_write`, and `memory_forget`.
- Store active memory in a JSONL file and optionally move forgotten entries to an archive file.
- Search a recent tail window first, reinforce recalled entries automatically, and prune stale noise regularly.

## Workflow decision tree

### Recall context
Run `memory_search` at the start of every task unless the user explicitly says not to.

Run it again mid-task whenever any of these are true:
- the user refers to a prior decision, constraint, or preference
- you are about to make an architectural or behavioral choice
- you suspect there is already stored context that could prevent duplicated work

### Persist knowledge
Run `memory_write` at least once for every substantive task.

Prefer durable memories such as:
- user preferences and stable constraints
- repository facts or validated workflows
- decisions that future tasks should reuse
- concise task outcomes worth carrying forward

When a task is mostly exploratory, a short end-of-task summary is enough.

Set `strength` higher for information that should survive pruning.

### Reinforce useful memories
Leave `reinforce` enabled on `memory_search` unless you have a reason not to.

Recalled items automatically update `recall_count`, `last_recalled_at`, and occasionally `strength`, which helps frequently used memories stay easy to retrieve.

### Forget aggressively but safely
Use `memory_forget` whenever active memory is accumulating stale or low-value entries.

Typical forget candidates:
- duplicate entries
- contradicted or superseded facts
- one-off task details that no longer matter
- low-strength memories that have not been recalled in a long time

Use `dry_run:true` first when the match is broad.

Default to `mode:"archive"` if recovery matters. Use `mode:"delete"` for true deletion or `mode:"mark"` when you want entries hidden from normal search without removing them.

### Avoid writing
Do not write secrets, tokens, scratchpad reasoning, raw logs, or transient one-off details.

## Setup

Source the script before using the functions:

```bash
source scripts/memory.sh
```

Optionally override the storage file:

```bash
export MEMORY_WORKSPACE_DIR="$PWD"
export MEMORY_FILE="$PWD/.agents/memory.jsonl"
```

Optionally separate active and forgotten memory:

```bash
export MEMORY_ARCHIVE_FILE="$PWD/.agents/memory.archive.jsonl"
```

Bootstrap an existing workspace before the first real task when you want memory to start with project context instead of an empty file:

```bash
bash scripts/bootstrap-memory.sh "$PWD"
```

## Storage format

- Store active entries in `${MEMORY_FILE:-<workspace>/.agents/memory.jsonl}`; create it if missing.
- Resolve `<workspace>` from the installed skill path under `.agents/skills`, `.claude/skills`, `.copilot/skills`, or `.codex/skills` unless `MEMORY_WORKSPACE_DIR` overrides it.
- Store forgotten entries in `${MEMORY_ARCHIVE_FILE}` when `memory_forget` runs in archive mode.
- Write one JSON object per line with at least:
  - `id`: stable entry identifier
  - `ts`: ISO8601 timestamp in UTC
  - `type`: string (for example `note`, `fact`, `decision`, `task_summary`)
  - `content`: string
  - `tags`: array of strings
  - `meta`: optional object
  - `strength`: integer from 1 to 5
  - `recall_count`: integer
  - `last_recalled_at`: nullable ISO8601 timestamp
- `memory_search` and `memory_forget` may rewrite the active file to reinforce or remove entries. That is expected.

## Write workflow (`memory_write`)

- Pass input as JSON: `{type, content, tags?, meta?, strength?}`.
- Generate valid JSON via `jq`; do not hand-build JSON strings.
- Append exactly one JSON object per line.

Example:
```bash
memory_write '{"type":"note","content":"Prefers terse status updates.","tags":["preference"],"strength":5}'
```

## Search workflow (`memory_search`)

- Pass input as JSON: `{q?, limit?, window_lines?, mode?, type?, tags?, min_strength?, reinforce?, case_sensitive?}`.
- Default `mode` is `literal`. Use `mode:"regex"` only when needed.
- Search a tail window first and expand exponentially if results are insufficient.
- Search is case-insensitive by default.
- Returned entries are ordered by strength and recent recall.
- By default, successful recalls reinforce the matched memories.
- Return output: `{ok, results, truncated, used_window_lines}`.

Example:
```bash
memory_search '{"q":"prefers","limit":5,"type":"note","reinforce":true}'
```

## Forget workflow (`memory_forget`)

- Pass input as JSON with at least one selector: `{ids?, q?, type?, tags?, before_ts?, last_recalled_before?, max_strength?, max_recall_count?, limit?, mode?, dry_run?, reason?}`.
- The function removes matching entries from active memory by archiving, deleting, or marking them forgotten.
- Use broad selectors to keep active memory small, but prefer `dry_run:true` before destructive calls.

Examples:

```bash
memory_forget '{"q":"temporary workaround","mode":"archive","dry_run":true}'
memory_forget '{"last_recalled_before":"2026-01-01T00:00:00Z","max_strength":2,"max_recall_count":0,"mode":"archive","reason":"stale low-value memories"}'
```

## Requirements

- Depend on standard unix tools: bash, touch, tail, jq, and rg or grep.
- Provide fallbacks: if rg is missing, use grep; if jq is missing, fail with a clear error.
- Make sure commands are safe with arbitrary user text through proper quoting.
- Ensure the skill returns structured JSON to the agent, not raw text logs.
- Require bash and jq; use rg or grep, tail, date, printf, touch, mkdir, mv, mktemp, wc, and optionally uuidgen.
- Allow tools: Bash(date:*) Bash(jq:*) Bash(printf:*) Bash(touch:*) Bash(tail:*) Bash(rg:*) Bash(grep:*) Bash(mkdir:*) Bash(mv:*) Bash(mktemp:*) Bash(wc:*) Bash(uuidgen:*)