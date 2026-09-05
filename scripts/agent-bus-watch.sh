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
INTERVAL="${2:-30}"

case "$WHO" in
  claude|gemini|operator) ;;
  *) echo "usage: agent-bus-watch.sh <claude|gemini|operator> [interval_seconds]" >&2; exit 1 ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

STATE="$(mktemp -t "bus-watch-${WHO}-XXXXXX")"
NEXT="${STATE}.next"
trap 'rm -f "$STATE" "$NEXT"' EXIT

snapshot() {
  bash scripts/agent-bus.sh list --to "$WHO" 2>/dev/null | grep -oE 'BUS-[0-9]+' | sort -u
}

# Baseline: everything already open is NOT news.
snapshot > "$STATE" 2>/dev/null || : > "$STATE"

while true; do
  sleep "$INTERVAL"
  snapshot > "$NEXT" 2>/dev/null || : > "$NEXT"
  # comm needs both sides sorted; snapshot() already sorts.
  new="$(comm -13 "$STATE" "$NEXT" 2>/dev/null)"
  if [ -n "$new" ]; then
    for b in $new; do
      body="$(awk -v id="$b" 'index($0, "[OPEN] " id) {f=1; next} f && NF {print; exit}' .agent-bus/OPEN.md 2>/dev/null)"
      echo "BUS ITEM FOR ${WHO^^}: $b :: ${body:0:400}"
    done
    mv "$NEXT" "$STATE"
  fi
done
