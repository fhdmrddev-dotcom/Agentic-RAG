#!/usr/bin/env bash
# Block until the bus carries an OPEN item addressed to <party> whose first body line matches <regex>,
# or until an existing item <BUS-NNN> has a non-empty **Answer:**. Prints the match and exits 0.
#
#   agent-bus-wait.sh --to gemini "226 PREFLIGHT LANDED"          # wait for a new item
#   agent-bus-wait.sh --answer BUS-071                             # wait for an answer on my item
#   AGENT_BUS_WAIT_SECS=30 AGENT_BUS_WAIT_MAX=14400 ...            # poll interval / give-up (default 60s / 8h)
#
# Exit 0 matched · 1 usage · 3 timed out. Polling a file is the whole mechanism: neither agent can
# wake the other, so the waiting side polls the mailbox instead of the operator relaying.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUS="$ROOT/.agent-bus/OPEN.md"
every="${AGENT_BUS_WAIT_SECS:-60}"; max="${AGENT_BUS_WAIT_MAX:-28800}"
mode="" party="" pat="" id=""
while [ $# -gt 0 ]; do
  case "$1" in
    --to) mode=item; party="${2:-}"; shift 2;;
    --answer) mode=answer; id="${2:-}"; shift 2;;
    *) pat="$1"; shift;;
  esac
done
[ -n "$mode" ] || { echo "usage: $0 --to <party> \"<regex>\" | --answer BUS-NNN" >&2; exit 1; }
waited=0
while :; do
  if [ "$mode" = item ]; then
    hit=$(awk -v p="to:$party" -v re="$pat" '
      index($0,"### [OPEN]")==1 { hdr=$0; want=index($0,p)>0; next }
      want && NF && $0 !~ /^\*\*Answer:/ { if ($0 ~ re) { print hdr; print $0; exit } ; want=0 }' "$BUS")
  else
    hit=$(awk -v id="$id" '
      index($0,"### [")==1 { in_item=index($0,id)>0; next }
      in_item && /^\*\*Answer:\*\*/ { a=$0; sub(/^\*\*Answer:\*\*[ ]*/,"",a); if (length(a)>0) { print id " answered: " a; exit } }' "$BUS")
  fi
  [ -n "$hit" ] && { printf '%s\n' "$hit"; exit 0; }
  [ "$waited" -ge "$max" ] && { echo "agent-bus-wait: timed out after ${max}s" >&2; exit 3; }
  sleep "$every"; waited=$((waited+every))
done
