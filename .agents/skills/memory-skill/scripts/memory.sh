# --- internal helpers ---

_memory_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

# Resolve the directory where this helper script is installed.
_memory_script_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P
}

# Resolve the workspace root from the installed skill location.
_memory_workspace_dir() {
  local script_dir

  if [[ -n "${MEMORY_WORKSPACE_DIR:-}" ]]; then
    printf '%s' "$MEMORY_WORKSPACE_DIR"
    return 0
  fi

  script_dir="$(_memory_script_dir)"

  case "$script_dir" in
    */.agents/skills/*)
      printf '%s' "${script_dir%%/.agents/skills/*}"
      return 0
      ;;
    */.claude/skills/*)
      printf '%s' "${script_dir%%/.claude/skills/*}"
      return 0
      ;;
    */.copilot/skills/*)
      printf '%s' "${script_dir%%/.copilot/skills/*}"
      return 0
      ;;
    */.codex/skills/*)
      printf '%s' "${script_dir%%/.codex/skills/*}"
      return 0
      ;;
  esac

  pwd -P
}

_memory_require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf '%s\n' '{"ok":false,"error":"jq is required"}'
    return 1
  fi
}

_memory_file() {
  printf '%s' "${MEMORY_FILE:-$(_memory_workspace_dir)/.agents/memory.jsonl}"
}

_memory_archive_file() {
  if [[ -n "${MEMORY_ARCHIVE_FILE:-}" ]]; then
    printf '%s' "$MEMORY_ARCHIVE_FILE"
  else
    printf '%s.archive' "$(_memory_file)"
  fi
}

_memory_prepare_file() {
  local file="$1"

  mkdir -p "$(dirname "$file")"
  touch "$file"
}

_memory_new_id() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    printf 'mem-%s-%s-%s' "$(date -u '+%s')" "$$" "${RANDOM:-0}"
  fi
}

_memory_jsonl_to_array() {
  jq -Rcs 'split("\n") | map(select(length > 0) | (fromjson?)) | map(select(. != null))'
}

_memory_search_window() {
  local file="$1"
  local q="$2"
  local window_lines="$3"
  local mode="$4"
  local case_sensitive="$5"
  local search_cmd

  if [[ ! -s "$file" ]]; then
    printf '%s' '[]'
    return 0
  fi

  if [[ -z "$q" ]]; then
    tail -n "$window_lines" "$file" | _memory_jsonl_to_array
    return 0
  fi

  if command -v rg >/dev/null 2>&1; then
    if [[ "$mode" == "regex" ]]; then
      if [[ "$case_sensitive" == "true" ]]; then
        search_cmd=(rg --no-filename -- "$q")
      else
        search_cmd=(rg -i --no-filename -- "$q")
      fi
    else
      if [[ "$case_sensitive" == "true" ]]; then
        search_cmd=(rg -F --no-filename -- "$q")
      else
        search_cmd=(rg -Fi --no-filename -- "$q")
      fi
    fi
  else
    if [[ "$mode" == "regex" ]]; then
      if [[ "$case_sensitive" == "true" ]]; then
        search_cmd=(grep -E -- "$q")
      else
        search_cmd=(grep -Ei -- "$q")
      fi
    else
      if [[ "$case_sensitive" == "true" ]]; then
        search_cmd=(grep -F -- "$q")
      else
        search_cmd=(grep -Fi -- "$q")
      fi
    fi
  fi

  tail -n "$window_lines" "$file" | { "${search_cmd[@]}" || true; } | _memory_jsonl_to_array
}

_memory_apply_reinforcement() {
  local payload_json="$1"
  local ids_json="$2"
  local now="$3"

  printf '%s' "$payload_json" | jq -c --argjson ids "$ids_json" --arg now "$now" '
    def reinforce:
      . as $entry
      | ($entry.recall_count // 0) as $count
      | .recall_count = ($count + 1)
      | .last_recalled_at = $now
      | .strength = (
          if (($count + 1) % 3 == 0) then
            (($entry.strength // 3) + 1)
          else
            ($entry.strength // 3)
          end
          | if . > 5 then 5 else . end
        );
    map(
      . as $entry
      | if (($ids | index($entry.id)) != null) then
          $entry | reinforce
        else
          $entry
        end
    )'
}

_memory_rewrite_with_reinforcement() {
  local file="$1"
  local ids_json="$2"
  local now="$3"
  local tmp_file

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/memory-reinforce.XXXXXX")" || return 1

  if ! jq -c --argjson ids "$ids_json" --arg now "$now" '
    def reinforce:
      . as $entry
      | ($entry.recall_count // 0) as $count
      | .recall_count = ($count + 1)
      | .last_recalled_at = $now
      | .strength = (
          if (($count + 1) % 3 == 0) then
            (($entry.strength // 3) + 1)
          else
            ($entry.strength // 3)
          end
          | if . > 5 then 5 else . end
        );
    . as $entry
    | if (($ids | index($entry.id)) != null) then
        $entry | reinforce
      else
        $entry
      end
  ' "$file" > "$tmp_file"; then
    rm -f "$tmp_file"
    return 1
  fi

  mv "$tmp_file" "$file"
}

# --- memory_write ---
# Build a durable JSONL entry and append it to the active memory file.
memory_write() {
  local input_json file ts entry entry_id

  input_json="${1:-}"
  if [[ -z "$input_json" ]]; then
    input_json="$(cat)"
  fi

  if ! _memory_require_jq; then
    return 1
  fi

  file="$(_memory_file)"
  _memory_prepare_file "$file"
  ts="$(_memory_now)"
  entry_id="$(_memory_new_id)"

  if ! entry="$(printf '%s' "$input_json" | jq -c --arg id "$entry_id" --arg ts "$ts" '
    {
      id: (.id // $id),
      ts: (.ts // $ts),
      type: (.type // "note"),
      content: (.content // ""),
      tags: (
        if .tags == null then []
        elif (.tags | type) == "array" then .tags
        else [ .tags ]
        end
      ),
      meta: (
        if .meta == null or (.meta | type) == "object" then .meta
        else {value: .meta}
        end
      ),
      strength: (
        ((.strength // 3) | tonumber? // 3)
        | if . < 1 then 1 elif . > 5 then 5 else . end
      ),
      recall_count: ((.recall_count // 0) | tonumber? // 0),
      last_recalled_at: (.last_recalled_at // null),
      forgotten: false,
      forgotten_at: null,
      forget_reason: null
    }
  ' 2>/dev/null)"; then
    printf '%s\n' '{"ok":false,"error":"invalid input json"}'
    return 1
  fi

  printf '%s\n' "$entry" >> "$file"
  jq -cn --arg file "$file" --argjson entry "$entry" '{ok:true,file:$file,entry:$entry}'
}

# --- memory_search ---
# Search active memory, rank useful matches, and optionally reinforce recalls.
memory_search() {
  local input_json parsed_json file q limit window_lines mode type_json tags_json min_strength
  local include_forgotten reinforce case_sensitive regex_flags used_window max_window
  local line_count candidates results total_count truncated ids_json now

  input_json="${1:-}"
  if [[ -z "$input_json" ]]; then
    input_json="$(cat)"
  fi

  if ! _memory_require_jq; then
    printf '%s\n' '{"ok":false,"error":"jq is required","results":[],"truncated":false,"used_window_lines":0}'
    return 1
  fi

  if ! parsed_json="$(printf '%s' "$input_json" | jq -c '
    {
      q: (.q // ""),
      limit: ((.limit // 10) | tonumber? // 10),
      window_lines: ((.window_lines // 50000) | tonumber? // 50000),
      mode: (if .mode == "regex" then "regex" else "literal" end),
      type: (.type // null),
      tags: (
        if .tags == null then []
        elif (.tags | type) == "array" then .tags
        else [ .tags ]
        end
      ),
      min_strength: ((.min_strength // 1) | tonumber? // 1),
      include_forgotten: (.include_forgotten // false),
      reinforce: (.reinforce // true),
      case_sensitive: (.case_sensitive // false)
    }
  ' 2>/dev/null)"; then
    printf '%s\n' '{"ok":false,"error":"invalid input json","results":[],"truncated":false,"used_window_lines":0}'
    return 1
  fi

  if ! IFS=$'\t' read -r q limit window_lines mode type_json tags_json min_strength include_forgotten reinforce case_sensitive <<<"$(printf '%s' "$parsed_json" | jq -r '[.q, .limit, .window_lines, .mode, (.type | tojson), (.tags | tojson), .min_strength, .include_forgotten, .reinforce, .case_sensitive] | @tsv')"; then
    printf '%s\n' '{"ok":false,"error":"invalid parsed input","results":[],"truncated":false,"used_window_lines":0}'
    return 1
  fi

  if [[ "$limit" -lt 1 ]]; then
    limit=10
  fi
  if [[ "$window_lines" -lt 1 ]]; then
    window_lines=50000
  fi

  file="$(_memory_file)"
  _memory_prepare_file "$file"
  line_count="$(wc -l < "$file" | tr -d '[:space:]')"
  if [[ -z "$line_count" ]]; then
    line_count=0
  fi

  used_window="$window_lines"
  max_window=1000000
  regex_flags='i'
  if [[ "$case_sensitive" == "true" ]]; then
    regex_flags=''
  fi

  results='[]'
  total_count=0

  while :; do
    if ! candidates="$(_memory_search_window "$file" "$q" "$used_window" "$mode" "$case_sensitive")"; then
      printf '%s\n' '{"ok":false,"error":"search failed","results":[],"truncated":false,"used_window_lines":0}'
      return 1
    fi

    if ! results="$(printf '%s' "$candidates" | jq -c \
      --arg q "$q" \
      --arg mode "$mode" \
      --argjson type "$type_json" \
      --argjson tags "$tags_json" \
      --argjson min_strength "$min_strength" \
      --argjson include_forgotten "$include_forgotten" \
      --argjson case_sensitive "$case_sensitive" \
      --arg regex_flags "$regex_flags" '
        def text_blob:
          [(.content // ""), (.type // ""), ((.tags // []) | join(" ")), ((.meta // {}) | tostring)] | join(" ");
        def text_match:
          if ($q | length) == 0 then
            true
          elif $mode == "regex" then
            (text_blob | test($q; $regex_flags))
          elif $case_sensitive then
            (text_blob | contains($q))
          else
            ((text_blob | ascii_downcase) | contains($q | ascii_downcase))
          end;
        map(select(
          ($include_forgotten or ((.forgotten // false) | not))
          and (($type == null) or (.type == $type))
          and (((.strength // 3) | tonumber? // 3) >= $min_strength)
          and (($tags | length) == 0 or (($tags - (.tags // [])) | length == 0))
          and text_match
        ))
        | sort_by([(.strength // 3), (.last_recalled_at // ""), (.ts // "")])
        | reverse
      ' 2>/dev/null)"; then
      printf '%s\n' '{"ok":false,"error":"invalid search output","results":[],"truncated":false,"used_window_lines":0}'
      return 1
    fi

    total_count="$(printf '%s' "$results" | jq -r 'length' 2>/dev/null)"
    if [[ "$total_count" -ge "$limit" || "$used_window" -ge "$max_window" || "$used_window" -ge "$line_count" ]]; then
      break
    fi

    used_window=$((used_window * 4))
    if [[ "$used_window" -gt "$max_window" ]]; then
      used_window="$max_window"
    fi
  done

  truncated=false
  if [[ "$total_count" -gt "$limit" ]]; then
    truncated=true
  fi

  results="$(printf '%s' "$results" | jq -c --argjson limit "$limit" '.[0:$limit]' 2>/dev/null)"

  if [[ "$reinforce" == "true" ]]; then
    ids_json="$(printf '%s' "$results" | jq -c 'map(.id) | map(select(. != null))' 2>/dev/null)"
    if [[ "$ids_json" != "[]" ]]; then
      now="$(_memory_now)"
      if ! _memory_rewrite_with_reinforcement "$file" "$ids_json" "$now"; then
        printf '%s\n' '{"ok":false,"error":"failed to reinforce recalled entries","results":[],"truncated":false,"used_window_lines":0}'
        return 1
      fi
      results="$(_memory_apply_reinforcement "$results" "$ids_json" "$now")"
    fi
  fi

  jq -cn \
    --argjson results "$results" \
    --argjson truncated "$truncated" \
    --argjson used_window_lines "$used_window" \
    '{ok:true,results:$results,truncated:$truncated,used_window_lines:$used_window_lines}'
}

# --- memory_forget ---
# Remove, archive, or mark low-value memories so active memory stays relevant.
memory_forget() {
  local input_json parsed_json file archive_file ids_json q mode type_json tags_json before_ts_json
  local last_recalled_before_json max_strength_json max_recall_count_json limit reason_json
  local dry_run case_sensitive regex_flags selector_count matched_entries matched_ids matched_count
  local tmp_file now

  input_json="${1:-}"
  if [[ -z "$input_json" ]]; then
    input_json="$(cat)"
  fi

  if ! _memory_require_jq; then
    return 1
  fi

  if ! parsed_json="$(printf '%s' "$input_json" | jq -c '
    {
      ids: (
        if .ids == null then []
        elif (.ids | type) == "array" then .ids
        else [ .ids ]
        end
      ),
      q: (.q // ""),
      mode: (
        if .mode == "delete" or .mode == "mark" then .mode
        else "archive"
        end
      ),
      type: (.type // null),
      tags: (
        if .tags == null then []
        elif (.tags | type) == "array" then .tags
        else [ .tags ]
        end
      ),
      before_ts: (.before_ts // null),
      last_recalled_before: (.last_recalled_before // null),
      max_strength: (if .max_strength == null then null else ((.max_strength | tonumber?) // null) end),
      max_recall_count: (if .max_recall_count == null then null else ((.max_recall_count | tonumber?) // null) end),
      limit: ((.limit // 50) | tonumber? // 50),
      reason: (.reason // null),
      dry_run: (.dry_run // false),
      case_sensitive: (.case_sensitive // false)
    }
  ' 2>/dev/null)"; then
    printf '%s\n' '{"ok":false,"error":"invalid input json"}'
    return 1
  fi

  if ! IFS=$'\t' read -r ids_json q mode type_json tags_json before_ts_json last_recalled_before_json max_strength_json max_recall_count_json limit reason_json dry_run case_sensitive <<<"$(printf '%s' "$parsed_json" | jq -r '[ (.ids | tojson), .q, .mode, (.type | tojson), (.tags | tojson), (.before_ts | tojson), (.last_recalled_before | tojson), (.max_strength | tojson), (.max_recall_count | tojson), .limit, (.reason | tojson), .dry_run, .case_sensitive ] | @tsv')"; then
    printf '%s\n' '{"ok":false,"error":"invalid parsed input"}'
    return 1
  fi

  selector_count="$(printf '%s' "$parsed_json" | jq -r '[ (.ids | length > 0), (.q != ""), (.type != null), (.tags | length > 0), (.before_ts != null), (.last_recalled_before != null), (.max_strength != null), (.max_recall_count != null) ] | map(select(.)) | length')"
  if [[ "$selector_count" -eq 0 ]]; then
    printf '%s\n' '{"ok":false,"error":"memory_forget requires at least one selector"}'
    return 1
  fi

  if [[ "$limit" -lt 1 ]]; then
    limit=50
  fi

  file="$(_memory_file)"
  _memory_prepare_file "$file"
  archive_file="$(_memory_archive_file)"
  regex_flags='i'
  if [[ "$case_sensitive" == "true" ]]; then
    regex_flags=''
  fi

  if ! matched_entries="$(jq -cs \
    --argjson ids "$ids_json" \
    --arg q "$q" \
    --argjson type "$type_json" \
    --argjson tags "$tags_json" \
    --argjson before_ts "$before_ts_json" \
    --argjson last_recalled_before "$last_recalled_before_json" \
    --argjson max_strength "$max_strength_json" \
    --argjson max_recall_count "$max_recall_count_json" \
    --argjson limit "$limit" \
    --argjson case_sensitive "$case_sensitive" \
    --arg regex_flags "$regex_flags" '
      def text_blob:
        [(.content // ""), (.type // ""), ((.tags // []) | join(" ")), ((.meta // {}) | tostring)] | join(" ");
      def text_match:
        if ($q | length) == 0 then
          true
        elif $case_sensitive then
          (text_blob | contains($q))
        else
          ((text_blob | ascii_downcase) | contains($q | ascii_downcase))
        end;
      map(select(
        ((.forgotten // false) | not)
        and (($ids | length) == 0 or (($ids | index(.id)) != null))
        and (($type == null) or (.type == $type))
        and (($tags | length) == 0 or (($tags - (.tags // [])) | length == 0))
        and (($before_ts == null) or ((.ts // "") <= $before_ts))
        and (($last_recalled_before == null) or (((.last_recalled_at // "") == "") or ((.last_recalled_at // "") <= $last_recalled_before)))
        and (($max_strength == null) or (((.strength // 3) | tonumber? // 3) <= $max_strength))
        and (($max_recall_count == null) or (((.recall_count // 0) | tonumber? // 0) <= $max_recall_count))
        and text_match
      ))
      | sort_by([(.strength // 3), (.last_recalled_at // ""), (.ts // "")])
      | .[0:$limit]
    ' "$file" 2>/dev/null)"; then
    printf '%s\n' '{"ok":false,"error":"failed to evaluate forget candidates"}'
    return 1
  fi

  matched_ids="$(printf '%s' "$matched_entries" | jq -c 'map(.id) | map(select(. != null))' 2>/dev/null)"
  matched_count="$(printf '%s' "$matched_entries" | jq -r 'length' 2>/dev/null)"

  if [[ "$dry_run" == "true" || "$matched_count" -eq 0 ]]; then
    jq -cn \
      --arg file "$file" \
      --arg mode "$mode" \
      --argjson dry_run "$dry_run" \
      --argjson matched_count "$matched_count" \
      --argjson ids "$matched_ids" \
      --argjson entries "$matched_entries" \
      '{ok:true,file:$file,mode:$mode,dry_run:$dry_run,matched_count:$matched_count,forgotten_ids:$ids,entries:$entries}'
    return 0
  fi

  if [[ "$mode" == "archive" ]]; then
    _memory_prepare_file "$archive_file"
    printf '%s' "$matched_entries" | jq -cr '.[]' >> "$archive_file"
  fi

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/memory-forget.XXXXXX")" || {
    printf '%s\n' '{"ok":false,"error":"failed to allocate temp file"}'
    return 1
  }

  if [[ "$mode" == "mark" ]]; then
    now="$(_memory_now)"
    if ! jq -c --argjson ids "$matched_ids" --arg now "$now" --argjson reason "$reason_json" '
      . as $entry
      | if (($ids | index($entry.id)) != null) then
          $entry
          | .forgotten = true
          | .forgotten_at = $now
          | .forget_reason = $reason
        else
          $entry
        end
    ' "$file" > "$tmp_file"; then
      rm -f "$tmp_file"
      printf '%s\n' '{"ok":false,"error":"failed to mark forgotten entries"}'
      return 1
    fi
  else
    if ! jq -c --argjson ids "$matched_ids" '
      . as $entry
      | select(($ids | index($entry.id)) == null)
    ' "$file" > "$tmp_file"; then
      rm -f "$tmp_file"
      printf '%s\n' '{"ok":false,"error":"failed to rewrite memory file"}'
      return 1
    fi
  fi

  mv "$tmp_file" "$file"

  jq -cn \
    --arg file "$file" \
    --arg archive_file "$archive_file" \
    --arg mode "$mode" \
    --argjson matched_count "$matched_count" \
    --argjson ids "$matched_ids" \
    '{ok:true,file:$file,archive_file:(if $mode == "archive" then $archive_file else null end),mode:$mode,dry_run:false,matched_count:$matched_count,forgotten_ids:$ids}'
}