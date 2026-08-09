#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# teardown-worktree.sh — remove a bootstrapped worktree WITHOUT following its
# junctions.
#
# WHY THIS EXISTS — read before changing anything here
# ----------------------------------------------------
# `bootstrap-worktree.sh` junctions `backend/venv` and `frontend/node_modules`
# into the worktree. Two consequences, both measured 2026-08-10:
#
#   1. `git worktree remove <path> --force` FAILS with "Invalid argument" — git
#      will not recurse through the reparse points. The worktree is left on disk
#      even though `git worktree prune` happily deregisters it.
#
#   2. FAR WORSE: a naive `rm -rf <worktree>` FOLLOWS a junction and deletes the
#      REAL `backend/venv` and `frontend/node_modules` in the operator's main
#      checkout. That is a multi-GB, multi-minute rebuild and it is silent.
#
# So the junctions must be detached FIRST, as reparse points, before anything
# recursive touches the directory. `[System.IO.Directory]::Delete($p, $false)`
# removes the link only and never follows it — the `$false` (non-recursive) is
# the load-bearing argument.
#
# USAGE
#   bash scripts/teardown-worktree.sh <worktree_path>
#   bash scripts/teardown-worktree.sh --all-agents   # every .claude/worktrees/agent-*
# ---------------------------------------------------------------------------
set -uo pipefail

REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repo" >&2; exit 1; }
MAIN="$(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')"
MAIN="$(cd "$MAIN" && pwd -P)"

fail() { echo "TEARDOWN FAILED: $*" >&2; exit 1; }

unlink_junction() {
  local p="$1" win
  [ -e "$p" ] || return 0
  win="$(cygpath -w "$p" 2>/dev/null || echo "$p")"
  local kind
  kind="$(powershell.exe -NoProfile -NonInteractive -Command \
    "(Get-Item -LiteralPath '$win' -Force -ErrorAction SilentlyContinue).LinkType" 2>/dev/null | tr -d '\r\n ')"
  if [ "$kind" = "Junction" ] || [ "$kind" = "SymbolicLink" ]; then
    powershell.exe -NoProfile -NonInteractive -Command \
      "[System.IO.Directory]::Delete('$win', \$false)" >/dev/null 2>&1 \
      || fail "could not detach junction: $p"
    echo "  detached junction: ${p#$REPO/}"
  else
    # A REAL directory sitting where a junction was expected. Refuse to guess.
    fail "expected a junction at $p but found a real directory — refusing to delete it.
  Inspect it by hand; deleting it blindly is how the operator's venv disappears."
  fi
}

teardown_one() {
  local WT="$1"
  [ -d "$WT" ] || { echo "not a directory, skipped: $WT"; return 0; }
  WT="$(cd "$WT" && pwd -P)"
  [ "$WT" != "$MAIN" ] || fail "refusing to tear down the MAIN worktree ($WT)"

  echo "Tearing down: $WT"
  unlink_junction "$WT/backend/venv"
  unlink_junction "$WT/frontend/node_modules"

  # Only now is anything recursive safe.
  if git -C "$MAIN" worktree remove "$WT" --force >/dev/null 2>&1; then
    echo "  git worktree remove: ok"
  else
    rm -rf "$WT" || fail "could not remove $WT"
    echo "  removed on disk (git had already deregistered it)"
  fi
}

if [ "${1:-}" = "--all-agents" ]; then
  shopt -s nullglob
  found=0
  for d in "$MAIN"/.claude/worktrees/agent-*; do
    [ -d "$d" ] || continue
    found=1
    teardown_one "$d"
  done
  [ "$found" = 1 ] || echo "no agent worktrees found"
else
  [ $# -ge 1 ] || fail "usage: teardown-worktree.sh <worktree_path> | --all-agents"
  teardown_one "$1"
fi

git -C "$MAIN" worktree prune
echo "TEARDOWN OK"

# Post-condition the operator actually cares about.
if [ -x "$MAIN/backend/venv/Scripts/python.exe" ] || [ -x "$MAIN/backend/venv/bin/python" ]; then
  echo "source venv: intact"
else
  echo "WARNING: source venv is NOT intact — check $MAIN/backend/venv" >&2
fi
[ -d "$MAIN/frontend/node_modules/vite" ] && echo "source node_modules: intact" \
  || echo "WARNING: source node_modules is NOT intact" >&2
