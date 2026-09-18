# shellcheck shell=bash
# bus-age.sh — THE single home of the agent bus's age computation.
#
# ⛔ NOTHING EXECUTES WHEN THIS FILE IS SOURCED. No `set` line, no dispatch, no side effect —
#    it defines one function and returns. That is a requirement, not tidiness:
#      · `.claude/hooks/agent-bus-check.sh` runs at EVERY session and subagent start and
#        deliberately runs without `-e`; inheriting `set -euo pipefail` from a sourced file
#        would let one unset variable kill every session start.
#      · `scripts/agent-bus.sh` `die`s when the bus file is missing and dispatches on `$1` at its
#        tail, so a bare `source scripts/agent-bus.sh` RUNS A COMMAND. That is why the function was
#        extracted here rather than the hook sourcing the CLI, and why a dispatch guard was not
#        enough.
#
# ⚠ WHY THIS FILE EXISTS AT ALL — measured, not anticipated. Two copies of this computation
#   already existed and had ALREADY DIVERGED before anything asked them to:
#     · `scripts/agent-bus.sh:37-44` — GNU `date -u -d` WITH a BSD `date -u -j -f` fallback and a
#       `"?"` sentinel its caller tests (`cmd_list`: `if [ "$age" != "?" ] && [ "$age" -ge 3 ]`).
#     · `.claude/hooks/agent-bus-check.sh:28-33` — inline, GNU-only, no fallback, no sentinel.
#   The better of the two is lifted here VERBATIM and both consumers now read it. ⛔ Do not write
#   a third: "a second parser that disagrees with the first is this project's recurring defect."

# Age in days of a YYYY-MM-DD date, portable across GNU/BSD date.
# Prints `?` when the date cannot be parsed — callers MUST test for it before arithmetic.
age_days() {
  local d="$1" then now
  then=$(date -u -d "$d" +%s 2>/dev/null || date -u -j -f %Y-%m-%d "$d" +%s 2>/dev/null || echo "")
  [ -n "$then" ] || { echo "?"; return; }
  now=$(date -u +%s)
  echo $(( (now - then) / 86400 ))
}
