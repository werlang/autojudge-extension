#!/usr/bin/env bash
set -euo pipefail

# Seed a workspace-local memory file from the workspace structure and a few high-signal files.
bootstrap_memory_usage() {
  cat <<'EOF'
Usage: bootstrap-memory.sh [workspace_dir] [--force] [--file relative/path]

Options:
  workspace_dir          Workspace to bootstrap. Defaults to the current directory.
  --file relative/path   Import an additional file from the workspace. Repeat as needed.
  --force                Re-import sources even if they were already bootstrapped.
  --help                 Show this help text.
EOF
}

# Resolve this script directory so we can source the memory helpers reliably.
bootstrap_memory_script_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P
}

# Return a workspace-relative path when the file lives under the workspace root.
bootstrap_memory_relative_path() {
  local workspace_dir="$1"
  local file_path="$2"

  case "$file_path" in
    "$workspace_dir"/*)
      printf '%s' "${file_path#"$workspace_dir"/}"
      ;;
    *)
      printf '%s' "$file_path"
      ;;
  esac
}

# Capture a compact text excerpt without flooding the memory file.
bootstrap_memory_text_excerpt() {
  local file_path="$1"

  awk 'NF { print; count += 1; if (count >= 20) exit }' "$file_path" \
    | tr '\n' ' ' \
    | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//'
}

# Summarize package metadata into a short durable note.
bootstrap_memory_package_excerpt() {
  local file_path="$1"

  jq -r '[
    (.name // empty),
    (.description // empty),
    ((.scripts // {}) | keys | if length > 0 then "scripts: " + (join(", ")) else empty end),
    "dependencies: " + (((.dependencies // {}) | keys | length) | tostring),
    "devDependencies: " + (((.devDependencies // {}) | keys | length) | tostring)
  ] | map(select(length > 0)) | join(" | ")' "$file_path"
}

# Build a concise content string based on file type.
bootstrap_memory_excerpt() {
  local file_path="$1"

  case "$(basename "$file_path")" in
    package.json)
      bootstrap_memory_package_excerpt "$file_path"
      ;;
    *)
      bootstrap_memory_text_excerpt "$file_path"
      ;;
  esac
}

# Avoid duplicate bootstrap entries unless the caller explicitly forces a refresh.
bootstrap_memory_source_exists() {
  local memory_file="$1"
  local source_path="$2"

  if [[ ! -s "$memory_file" ]]; then
    return 1
  fi

  jq -se --arg source_path "$source_path" 'any(.[]; (.meta.bootstrap_source // "") == $source_path)' "$memory_file" >/dev/null
}

# Write one bootstrap entry with consistent metadata so future refreshes can detect it.
bootstrap_memory_write_entry() {
  local entry_type="$1"
  local content="$2"
  local source_path="$3"
  local source_kind="$4"
  local strength="$5"

  local payload
  payload="$(jq -cn \
    --arg type "$entry_type" \
    --arg content "$content" \
    --arg source_path "$source_path" \
    --arg source_kind "$source_kind" \
    --argjson strength "$strength" '
      {
        type: $type,
        content: $content,
        tags: ["bootstrap", "workspace"],
        meta: {
          bootstrap_source: $source_path,
          bootstrap_kind: $source_kind
        },
        strength: $strength
      }
    ')"

  memory_write "$payload" >/dev/null
}

main() {
  local workspace_dir force import_count skip_count memory_file inventory content
  local script_dir rel_path candidate_path
  local -a candidate_files extra_files top_level_items bootstrap_files

  workspace_dir="$(pwd -P)"
  force=false
  import_count=0
  skip_count=0
  candidate_files=(
    README.md
    AGENTS.md
    task.md
    package.json
    compose.yaml
    compose.yml
    Dockerfile
    .github/copilot-instructions.md
    copilot-instructions.md
  )
  extra_files=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force)
        force=true
        shift
        ;;
      --file)
        if [[ $# -lt 2 ]]; then
          printf '%s\n' '{"ok":false,"error":"missing path after --file"}'
          return 1
        fi
        extra_files+=("$2")
        shift 2
        ;;
      --help)
        bootstrap_memory_usage
        return 0
        ;;
      -*)
        printf '%s\n' "{\"ok\":false,\"error\":\"unknown option: $1\"}"
        return 1
        ;;
      *)
        workspace_dir="$1"
        shift
        ;;
    esac
  done

  workspace_dir="$(cd "$workspace_dir" && pwd -P)"
  script_dir="$(bootstrap_memory_script_dir)"

  # shellcheck source=/dev/null
  source "$script_dir/memory.sh"
  export MEMORY_WORKSPACE_DIR="$workspace_dir"
  memory_file="$(_memory_file)"
  _memory_prepare_file "$memory_file"

  while IFS= read -r candidate_path; do
    top_level_items+=("$candidate_path")
  done < <(find "$workspace_dir" -mindepth 1 -maxdepth 1 ! -name .git ! -name .agents -exec basename {} \; | sort | head -n 12)
  inventory="$(printf '%s\n' "${top_level_items[@]}" | sed '/^$/d' | paste -sd ', ' -)"
  if [[ -n "$inventory" ]]; then
    if [[ "$force" == true ]] || ! bootstrap_memory_source_exists "$memory_file" "workspace:inventory"; then
      bootstrap_memory_write_entry "workspace_inventory" "Top-level workspace items: $inventory" "workspace:inventory" "inventory" 4
      import_count=$((import_count + 1))
    else
      skip_count=$((skip_count + 1))
    fi
  fi

  bootstrap_files=("${candidate_files[@]}")
  if [[ "${#extra_files[@]}" -gt 0 ]]; then
    bootstrap_files+=("${extra_files[@]}")
  fi

  for rel_path in "${bootstrap_files[@]}"; do
    candidate_path="$workspace_dir/$rel_path"
    if [[ ! -f "$candidate_path" ]]; then
      continue
    fi

    if [[ "$force" != true ]] && bootstrap_memory_source_exists "$memory_file" "$rel_path"; then
      skip_count=$((skip_count + 1))
      continue
    fi

    content="$(bootstrap_memory_excerpt "$candidate_path")"
    if [[ -z "$content" ]]; then
      continue
    fi

    bootstrap_memory_write_entry "workspace_context" "$content" "$rel_path" "file" 4
    import_count=$((import_count + 1))
  done

  jq -cn \
    --arg workspace_dir "$workspace_dir" \
    --arg memory_file "$memory_file" \
    --argjson imported "$import_count" \
    --argjson skipped "$skip_count" \
    '{ok:true,workspace_dir:$workspace_dir,memory_file:$memory_file,imported:$imported,skipped:$skipped}'
}

main "$@"
