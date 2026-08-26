#!/usr/bin/env bash
# Agent bus — the mailbox between Claude and Gemini on this project.
#
# Neither agent can wake the other; only the operator can. So this is a DURABLE MAILBOX
# checked automatically at each agent's next start, never a live link. See .agent-bus/README.md.
#
#   agent-bus.sh open --to claude|gemini|operator --from <who> "<one-line ask>"
#   agent-bus.sh list [--to claude|gemini|operator] [--all]
#   agent-bus.sh answer <BUS-NNN> "<answer>"
#   agent-bus.sh close  <BUS-NNN>
#   agent-bus.sh archive          # sweep CLOSED items out of OPEN.md
#
# Exit 0 clear · 1 usage/not-found · 2 harness error.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUS="$ROOT/.agent-bus/OPEN.md"
ARCHIVE="$ROOT/.agent-bus/archive/CLOSED.md"
VALID_PARTIES="claude gemini operator"

die() { echo "agent-bus: $*" >&2; exit 1; }
[ -f "$BUS" ] || die "no bus at $BUS (exit 2)"

today() { date -u +%Y-%m-%d; }

# Highest existing BUS-NNN across BOTH files, +1. Reading both is load-bearing: ids must never
# be reused after an archive sweep, or an answer can land on the wrong question.
next_id() {
  local max
  max=$( { cat "$BUS" "$ARCHIVE" 2>/dev/null || true; } \
    | grep -oE 'BUS-[0-9]{3}' | grep -oE '[0-9]{3}' | sort -n | tail -1 )
  printf 'BUS-%03d' $(( 10#${max:-0} + 1 ))
}

valid_party() { case " $VALID_PARTIES " in *" $1 "*) return 0;; *) return 1;; esac; }

# Age in days of a YYYY-MM-DD date, portable across GNU/BSD date.
age_days() {
  local d="$1" then now
  then=$(date -u -d "$d" +%s 2>/dev/null || date -u -j -f %Y-%m-%d "$d" +%s 2>/dev/null || echo "")
  [ -n "$then" ] || { echo "?"; return; }
  now=$(date -u +%s)
  echo $(( (now - then) / 86400 ))
}

cmd_open() {
  local to="" from="" body=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --to)   to="${2:-}";   shift 2;;
      --from) from="${2:-}"; shift 2;;
      *)      body="$1";     shift;;
    esac
  done
  [ -n "$to" ]   || die "open needs --to (${VALID_PARTIES// /|})"
  [ -n "$from" ] || die "open needs --from (${VALID_PARTIES// /|})"
  [ -n "$body" ] || die "open needs a one-line ask in quotes"
  valid_party "$to"   || die "unknown --to '$to' (${VALID_PARTIES// /|})"
  valid_party "$from" || die "unknown --from '$from' (${VALID_PARTIES// /|})"
  [ "$to" != "$from" ] || die "--to and --from are the same party"

  local id; id="$(next_id)"
  {
    printf '\n### [OPEN] %s · to:%s · from:%s · %s\n\n' "$id" "$to" "$from" "$(today)"
    printf '%s\n\n' "$body"
    printf '**Answer:**\n'
  } >> "$BUS"
  echo "opened $id → $to"
}

cmd_list() {
  local filter="" show_all=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --to)  filter="${2:-}"; shift 2;;
      --all) show_all=1;      shift;;
      *) shift;;
    esac
  done

  local pattern='^### \[OPEN\]'
  [ "$show_all" -eq 1 ] && pattern='^### \['

  local found=0 line id to from date age
  while IFS= read -r line; do
    id=$(  printf '%s' "$line" | grep -oE 'BUS-[0-9]{3}')
    to=$(  printf '%s' "$line" | sed -nE 's/.*to:([a-z]+).*/\1/p')
    from=$(printf '%s' "$line" | sed -nE 's/.*from:([a-z]+).*/\1/p')
    date=$(printf '%s' "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
    [ -n "$filter" ] && [ "$to" != "$filter" ] && continue
    age=$(age_days "$date")
    found=$((found+1))
    if [ "$age" != "?" ] && [ "$age" -ge 3 ]; then
      printf '  %s  to:%-8s from:%-8s  %s  ** %s DAYS OLD **\n' "$id" "$to" "$from" "$date" "$age"
    else
      printf '  %s  to:%-8s from:%-8s  %s  (%s d)\n' "$id" "$to" "$from" "$date" "$age"
    fi
  done < <(grep -E "$pattern" "$BUS" || true)

  [ "$found" -eq 0 ] && echo "  (nothing open${filter:+ for $filter})"
  return 0
}

cmd_answer() {
  local id="${1:-}" text="${2:-}"
  [ -n "$id" ] && [ -n "$text" ] || die "answer needs <BUS-NNN> \"<answer>\""
  grep -q "$id" "$BUS" || die "$id not found in OPEN.md"

  # ⚠ index(), never a regex. `"### \["` is a WARNING in gawk ("escape sequence \[ treated
  # as plain [") and then a FATAL invalid-regexp, and the first draft of this function reported
  # "answered" anyway while writing nothing. A verb that writes a false record is the defect
  # this project keeps paying for, so the success line below is gated on the write, not on reach.
  awk -v id="$id" -v ans="$text" '
    index($0, "### [") == 1 { initem = (index($0, id) > 0) }
    initem && $0 == "**Answer:**" && !done {
      print "**Answer:** " ans; done = 1; initem = 0; next
    }
    { print }
    END { exit(done ? 0 : 3) }
  ' "$BUS" > "$BUS.tmp" && rc=0 || rc=$?
  # `&& rc=0 || rc=$?` and NOT a bare `local rc=$?`: under `set -e` a non-zero awk aborts the
  # script AT the awk line, so the refusal message below never prints and the operator sees a
  # silent no-op. Driven: the double-answer case refused correctly but said nothing.
  if [ "${rc:-0}" -eq 0 ]; then
    mv "$BUS.tmp" "$BUS"; echo "answered $id"
  else
    rm -f "$BUS.tmp"
    [ "$rc" -eq 3 ] && die "$id has no empty **Answer:** line — already answered?"
    die "awk failed (rc=$rc); $BUS left untouched"
  fi
}

cmd_close() {
  local id="${1:-}"
  [ -n "$id" ] || die "close needs <BUS-NNN>"
  grep -q "$id" "$BUS" || die "$id not found in OPEN.md"
  sed -i.bak "s/^### \[OPEN\] $id /### [CLOSED] $id /" "$BUS" && rm -f "$BUS.bak"
  echo "closed $id"
}

cmd_archive() {
  local moved=0
  awk -v arch="$ARCHIVE" '
    /^### \[CLOSED\]/ { closed=1; print >> arch; next }
    /^### \[OPEN\]/   { closed=0 }
    closed { print >> arch; next }
    { print }
  ' "$BUS" > "$BUS.tmp" && mv "$BUS.tmp" "$BUS"
  moved=$(grep -cE '^### \[CLOSED\]' "$ARCHIVE" || true)
  echo "archived — CLOSED.md now holds $moved item(s)"
}

case "${1:-}" in
  open)    shift; cmd_open "$@";;
  list)    shift; cmd_list "$@";;
  answer)  shift; cmd_answer "$@";;
  close)   shift; cmd_close "$@";;
  archive) shift; cmd_archive "$@";;
  *) sed -n '3,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1;;
esac
