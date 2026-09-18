#!/usr/bin/env bash
# SessionStart — surface anything the other agent is waiting on Claude for, and how big the
# operator's own queue has grown.
#
# ⚠ THIS IS THE TRIGGER, and it is the whole reason the bus is not another register nobody
# reads. A mailbox checked by good intentions decays; this hook makes the check unskippable at
# every session start, including subagents.
#
# ⚠ CORRECTION 2026-09-16 (Phase 251) — the original sentence is kept below rather than deleted,
#   because a rotted figure in a comment is exactly the class of drift this phase exists to end:
#       "`.planning/seeds/` holds 188 `trigger_when` entries and the only command that greps
#        for SEED is the one that WRITES them"
#   ⛔ BOTH HALVES ARE NOW FALSE. Measured 2026-09-15: **157 `trigger_when` across 283 files**
#      (188 was probably the seed COUNT at the time, not the trigger count) — and the register is
#      **292 files** after Phase 251's renumber. And its premise died the same phase:
#      `scripts/check-seeds-register.cjs` now sweeps the register and is CALLED from
#      `/gsd:discuss-phase` and `/gsd:new-milestone`. The analogy this comment drew was sound; the
#      register it pointed at is the one that got a mechanism first.
#
# SILENT when there is nothing to say — a hook that prints on every start is noise, and noise is
# how a real item gets scrolled past. ⚠ D-14 adds a `to:operator` summary and DOES NOT trade that
# contract away: the summary prints only when the open `to:operator` count is non-zero, and the
# `to:claude` block only when that queue is non-empty. With both empty this hook still prints
# nothing at all.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BUS="$ROOT/.agent-bus/OPEN.md"
[ -f "$BUS" ] || exit 0

# ⛔ ONE home for the age computation — never a third copy. This file used to carry an inline,
#    GNU-only variant with no BSD fallback and no "?" sentinel, which had already diverged from
#    scripts/agent-bus.sh's. See scripts/lib/bus-age.sh for why it is a function-only file.
# shellcheck source=../../scripts/lib/bus-age.sh
. "$ROOT/scripts/lib/bus-age.sh"

# ── The three queues, counted BEFORE anything prints ────────────────────────────────────────
# ⛔ The old `[ -z "$items" ] && exit 0` sat here and fired whenever the to:claude queue was empty
#    — which is the NORMAL state. It suppressed the operator summary too, so the queue that
#    actually needs watching was the one that could never be reported. Counts first, print after.
items=$(grep -E '^### \[OPEN\].*to:claude' "$BUS" 2>/dev/null || true)
n_claude=$(grep -cE '^### \[OPEN\].*to:claude'   "$BUS" 2>/dev/null || true)
n_operator=$(grep -cE '^### \[OPEN\].*to:operator' "$BUS" 2>/dev/null || true)
n_gemini=$(grep -cE '^### \[OPEN\].*to:gemini'   "$BUS" 2>/dev/null || true)
n_claude=${n_claude:-0}; n_operator=${n_operator:-0}; n_gemini=${n_gemini:-0}

# ── The operator summary — one line, only when there is something in that queue ──────────────
if [ "$n_operator" -gt 0 ]; then
  # Oldest = the MINIMUM ISO date among the open to:operator headers. ISO dates sort lexically,
  # so `sort | head -1` is the earliest without any parsing.
  oldest_date=$(grep -E '^### \[OPEN\].*to:operator' "$BUS" \
    | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort | head -1)
  oldest_age=""
  [ -n "$oldest_date" ] && oldest_age=$(age_days "$oldest_date")
  # ⚠ age_days returns "?" on an unparseable date. Print the sentinel rather than a broken
  #    subtraction — a wrong number is worse than an admitted unknown.
  if [ -z "$oldest_age" ]; then
    oldest_phrase="oldest unknown (no date in any header)"
  elif [ "$oldest_age" = "?" ]; then
    oldest_phrase="oldest $oldest_date (unparseable)"
  else
    oldest_phrase="oldest $oldest_age days"
  fi
  echo "AGENT BUS — $n_operator open to:operator, $oldest_phrase · $n_gemini open to:gemini (gemini's to answer) · $n_claude open to:claude"
  echo "  List them:  bash scripts/agent-bus.sh list --to operator"
fi

# ── The to:claude detail block — unchanged behaviour, now independent of the summary ─────────
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
  d=$(age_days "$date")
  if [ "$d" != "?" ]; then
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
