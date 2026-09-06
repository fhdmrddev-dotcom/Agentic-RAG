#!/usr/bin/env bash
# Watch .agent-bus/OPEN.md for NEW items addressed to one agent.
#
# Emits one line per newly-opened item and nothing otherwise, so it is safe to
# feed straight into a Claude Code Monitor or a Gemini equivalent.
#
#   bash scripts/agent-bus-watch.sh claude [interval_seconds]
#   bash scripts/agent-bus-watch.sh gemini 30
#
# Exit 1 on usage error. Runs until killed.
set -uo pipefail

WHO="${1:-}"
shift || true
INTERVAL=30
EXIT_ON_ITEM=0
WATCH_ANSWER=""
TIMEOUT=0

case "$WHO" in
  claude|gemini|operator) ;;
  *) echo "usage: agent-bus-watch.sh <claude|gemini|operator> [interval_seconds] [--exit-on-item] [--watch-answer BUS-NNN] [--timeout seconds]" >&2; exit 1 ;;
esac

while [ $# -gt 0 ]; do
  case "$1" in
    --exit-on-item|--once) EXIT_ON_ITEM=1; shift;;
    --watch-answer) WATCH_ANSWER="${2:-}"; shift 2;;
    --timeout) TIMEOUT="${2:-0}"; shift 2;;
    [0-9]*) INTERVAL="$1"; shift;;
    *) shift;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

# ⚠ THE SEEN-SET IS PERSISTENT, AND THAT IS THE POINT.
#
# Until 2026-09-05 this was a mktemp file baselined with "everything already open is NOT
# news". That made every restart open a BLIND WINDOW: an item posted while no watcher was
# running was recorded as already-seen the moment one started, and could never fire again.
# It was measured doing exactly that — Gemini restarted its watcher, BUS-136 (the Phase 232
# pre-flight PASS) was open at the time, and the restarted watcher never announced it while
# Gemini reported itself "waiting for Claude's pre-flight sign-off".
#
# ⚠ A watcher is per SESSION (CLAUDE.md: "the bus watchers die with the session that started
# them"), so that blind window opened at EVERY session boundary, which is precisely when a
# handoff is most likely to be sitting unread.
#
# Persisting the seen-set across restarts closes it: a new watcher announces what arrived
# while nobody was listening, and stays quiet about what a previous run already reported.
BUS="$REPO/.agent-bus/OPEN.md"
SEEN_DIR="$REPO/.agent-bus"
SEEN="$SEEN_DIR/.watch-seen-${WHO}"
NEXT="$(mktemp -t "bus-watch-${WHO}-XXXXXX")"
trap 'rm -f "$NEXT" "$NEXT.tmp"' EXIT

snapshot() {
  grep -E '^### \[OPEN\]' "$BUS" 2>/dev/null | grep "to:$WHO" | grep -oE 'BUS-[0-9]+' | sort -u
}

emit() {
  local b body
  for b in $1; do
    body="$(awk -v id="$b" 'index($0, "[OPEN] " id) {f=1; next} f && NF {print; exit}' .agent-bus/OPEN.md 2>/dev/null)"
    echo "BUS ITEM FOR ${WHO^^}: $b :: ${body:0:400}"
  done
}

check_answer() {
  if [ -n "$WATCH_ANSWER" ]; then
    local ans
    ans=$(awk -v id="$WATCH_ANSWER" '
      index($0,"### [")==1 { in_item=index($0,id)>0; next }
      in_item && /^\*\*Answer:\*\*/ { a=$0; sub(/^\*\*Answer:\*\*[ ]*/,"",a); if (length(a)>0) { print id " answered: " a; exit } }' "$REPO/.agent-bus/OPEN.md" 2>/dev/null)
    if [ -n "$ans" ]; then
      echo "BUS ANSWER FOR ${WHO^^}: $ans"
      return 0
    fi
  fi
  return 1
}

snapshot > "$NEXT" 2>/dev/null || : > "$NEXT"

if [ ! -f "$SEEN" ]; then
  # FIRST EVER RUN for this agent. Everything open is unread by definition, but a mailbox
  # with a long backlog would flood the session with one notification per item — so the
  # backlog is announced as ONE summary line and then treated as seen. Nothing is hidden:
  # the ids are named, and `agent-bus.sh list --to <who>` reads the file directly.
  backlog="$(tr '
' ' ' < "$NEXT" | sed 's/ *$//')"
  n="$(wc -l < "$NEXT" | tr -d ' ')"
  [ -n "$backlog" ] && echo "BUS BACKLOG FOR ${WHO^^} at watch start ($n open): $backlog"
  cp "$NEXT" "$SEEN"
else
  # RESTART. Announce anything that arrived while no watcher was running — the blind window
  # this file used to swallow — one notification per item, exactly as in steady state.
  missed="$(comm -13 "$SEEN" "$NEXT" 2>/dev/null)"
  if [ -n "$missed" ]; then
    echo "BUS: catching up on items opened while no ${WHO} watcher was running —"
    emit "$missed"
    cp "$NEXT" "$SEEN"
    [ "$EXIT_ON_ITEM" -eq 1 ] && exit 0
  fi
fi

if check_answer; then
  [ "$EXIT_ON_ITEM" -eq 1 ] && exit 0
fi

waited=0
while true; do
  sleep "$INTERVAL"
  waited=$((waited + INTERVAL))
  snapshot > "$NEXT" 2>/dev/null || : > "$NEXT"
  # comm needs both sides sorted; snapshot() already sorts.
  new="$(comm -13 "$SEEN" "$NEXT" 2>/dev/null)"
  if [ -n "$new" ]; then
    emit "$new"
    # ⚠ Write the seen-set only AFTER emitting. A crash between the two re-announces an item,
    # which is cheap; the reverse order loses it silently, which is the bug above.
    cp "$NEXT" "$SEEN"
    [ "$EXIT_ON_ITEM" -eq 1 ] && exit 0
  fi
  if check_answer; then
    [ "$EXIT_ON_ITEM" -eq 1 ] && exit 0
  fi
  if [ "$TIMEOUT" -gt 0 ] && [ "$waited" -ge "$TIMEOUT" ]; then
    echo "BUS WATCH: reached timeout of ${TIMEOUT}s without new items"
    exit 0
  fi
done
