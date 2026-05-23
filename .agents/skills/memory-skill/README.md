# Memory Skill

A file-based long-term memory skill for AI agents, implemented with a JSONL active memory file and an optional archive. It is designed to behave more like human memory: recall useful context often, reinforce what gets reused, and forget what has gone stale.

## Features

- **File-based Storage**: Uses JSONL files that are easy to inspect, diff, and back up.
- **Human-like Recall**: Searches recent memory first, then expands outward only when needed.
- **Reinforcement**: Recalled entries automatically gain recall metadata so frequently used memories stay prominent.
- **Selective Forgetting**: Removes low-value memories from active storage by archiving, deleting, or marking them forgotten.
- **Lightweight**: Depends only on standard Unix tools like `bash`, `jq`, and `ripgrep` or `grep`.

## Memory Loop

The intended agent behavior is:

1. Start every task with `memory_search`.
2. Search again when context is missing or a prior decision might matter.
3. Write at least one durable memory with `memory_write` for each substantive task.
4. Periodically run `memory_forget` so active memory stays small and relevant.

## Usage

This skill provides three main capabilities to the agent:

### 1. Writing to Memory (`memory_write`)

Stores a new entry in the active memory file. Each entry gets a stable ID plus recall metadata so it can later be reinforced or forgotten.

**Input:**
- `type`: String (e.g., "note", "fact", "task", "todo")
- `content`: String (the raw text content)
- `tags`: (Optional) Array of strings
- `meta`: (Optional) JSON object for extra metadata
- `strength`: (Optional) Integer `1..5`, default `3`

**Storage Format:**
Entries are stored in `<workspace>/.agents/memory.jsonl` by default as:
```json
{"id":"f3bc0a3c-cb22-4a90-9bc8-2d7d7f1c84e7","ts":"2026-05-22T14:00:00Z","type":"note","content":"User prefers Python.","tags":["preference"],"meta":null,"strength":5,"recall_count":0,"last_recalled_at":null,"forgotten":false,"forgotten_at":null,"forget_reason":null}
```

The default workspace root is resolved in this order:
1. `MEMORY_WORKSPACE_DIR` if you set it explicitly.
2. The parent of the installed skill path when the skill lives under `.agents/skills`, `.claude/skills`, `.copilot/skills`, or `.codex/skills`.
3. The current directory as a last fallback.

### 2. Searching Memory (`memory_search`)

Retrieves relevant entries from memory based on a query string.

**Input:**
- `q`: Query string, optional if you are filtering mostly by tags or type
- `limit`: (Optional) Max number of results to return (default: 10)
- `window_lines`: (Optional) Number of recent lines to search (default: 50000)
- `mode`: (Optional) `literal` or `regex`, default `literal`
- `type`: (Optional) Filter by entry type
- `tags`: (Optional) Require all listed tags
- `min_strength`: (Optional) Ignore weak memories
- `reinforce`: (Optional) Default `true`; when enabled, recalled entries update `recall_count`, `last_recalled_at`, and sometimes `strength`

The search strategy uses a "hybrid" approach:
1. Reads the last `window_lines` of the file.
2. Filters lines using `rg` (ripgrep) or `grep`.
3. Parses valid JSON lines with `jq`.
4. Ranks matches by strength and recent recall.
5. Returns the most relevant matches.

### 3. Forgetting Memory (`memory_forget`)

Removes stale or low-value memories from the active file.

**Input:**
- At least one selector such as `ids`, `q`, `type`, `tags`, `before_ts`, `last_recalled_before`, `max_strength`, or `max_recall_count`
- `limit`: (Optional) Cap the number of forgotten entries
- `mode`: (Optional) `archive`, `delete`, or `mark`; default `archive`
- `dry_run`: (Optional) Preview what would be forgotten without changing files
- `reason`: (Optional) Persist why the memory was forgotten when using `mark`

Typical pruning command:

```bash
memory_forget '{"last_recalled_before":"2026-01-01T00:00:00Z","max_strength":2,"max_recall_count":0,"mode":"archive","dry_run":true}'
```

## Requirements

Ensure the environment has the following tools installed:
- `bash`
- `jq`
- `ripgrep` (recommended) or `grep`
- `tail`, `touch`, `date`, `printf`, `mkdir`, `mv`, `mktemp`, `wc`
- `uuidgen` (optional, recommended)

## Installation

Copy the `memory-skill` folder into your workspace skill configuration folder. For example:

- Codex: `<workspace>/.codex/skills`
- Claude Code: `<workspace>/.claude/skills`
- Copilot: `<workspace>/.copilot/skills`
- General Agents: `<workspace>/.agents/skills`

Then source the helper script:

```bash
source scripts/memory.sh
```

Optional environment variables for workspace-local storage:

```bash
export MEMORY_WORKSPACE_DIR="$PWD"
export MEMORY_FILE="$PWD/.agents/memory.jsonl"
export MEMORY_ARCHIVE_FILE="$PWD/.agents/memory.archive.jsonl"
```

## Bootstrap Existing Workspaces

Use the bootstrap helper to seed a workspace memory file from high-signal files such as `README.md`, `task.md`, and `package.json`.

From the workspace root:

```bash
bash memory/scripts/bootstrap-memory.sh "$PWD"
```

Useful options:

- `--force`: re-import sources even if they were already bootstrapped
- `--file relative/path`: include additional workspace files in the seed set

Example:

```bash
bash memory/scripts/bootstrap-memory.sh "$PWD" --file docs/architecture.md --force
```