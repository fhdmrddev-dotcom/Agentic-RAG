#!/usr/bin/env bash
# SessionStart — surface anything the other agent is waiting on Claude for.
#
# ⚠ THIS IS THE TRIGGER, and it is the whole reason the bus is not another register nobody
# reads. `.planning/seeds/` holds 188 `trigger_when` entries and the only command that greps
# for SEED is the one that WRITES them; a mailbox checked by good intentions decays the same
# way. This hook makes the check unskippable at every session start, including subagents.
#
# SILENT when there is nothing addressed to Claude — a hook that prints on every start is
# noise, and noise is how a real item gets scrolled past.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BUS="$ROOT/.agent-bus/OPEN.md"
[ -f "$BUS" ] || exit 0

items=$(grep -E '^### \[OPEN\].*to:claude' "$BUS" 2>/dev/null || true)
[ -z "$items" ] && exit 0

echo "════════════════════════════════════════════════════════════════"
echo "AGENT BUS — item(s) addressed to Claude and still OPEN:"
echo
while IFS= read -r line; do
  id=$(printf '%s' "$line" | grep -oE 'BUS-[0-9]{3}')
  from=$(printf '%s' "$line" | sed -nE 's/.*from:([a-z]+).*/\1/p')
  date=$(printf '%s' "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  body=$(awk -v id="$id" 'index($0,"### [")==1{p=(index($0,id)>0);next} p && NF && $0 !~ /^\*\*Answer:/{print;exit}' "$BUS")
  age=""
  then_s=$(date -u -d "$date" +%s 2>/dev/null || echo "")
  if [ -n "$then_s" ]; then
    d=$(( ( $(date -u +%s) - then_s ) / 86400 ))
    [ "$d" -ge 3 ] && age="  ** $d DAYS OLD **" || age="  (${d}d)"
  fi
  echo "  $id  from:$from$age"
  echo "    $body"
done <<< "$items"
echo
echo "  Answer:  bash scripts/agent-bus.sh answer <BUS-NNN> \"<answer>\""
echo "  Then:    bash scripts/agent-bus.sh close <BUS-NNN>"
echo "════════════════════════════════════════════════════════════════"
exit 0
