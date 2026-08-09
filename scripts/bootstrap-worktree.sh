#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# bootstrap-worktree.sh — make a fresh git worktree RUNNABLE.
#
# WHY THIS EXISTS
# ---------------
# `git worktree add` checks out TRACKED files only. Four things this project's
# verification depends on are gitignored, so a fresh worktree has none of them:
#
#     backend/venv            (pytest, every backend plan)
#     frontend/node_modules   (vite / vitest / tsc, every frontend plan)
#     backend/.env            (DB, crypto, secret tests)
#     frontend/.env.local     (frontend runtime config)
#
# Without this script every plan executed in a worktree FALSE-FAILS its own
# verification, which is why `workflow.use_worktrees` was pinned to `false` and
# GSD phases ran fully serially. Phase 190 measured the cost of that: 19 plans,
# 10.8 h of execution, against 5.7 h if the eight waves had run in parallel.
#
# WHAT IT DOES
# ------------
# venv + node_modules are JUNCTIONED (not copied) — they are multi-GB and a
# per-worktree copy would cost more than the serialisation it removes. Windows
# directory junctions need NO elevation (measured). The two .env files are
# COPIED, so a worktree can never mutate the operator's real environment.
#
# Idempotent: safe to re-run. Fails LOUDLY rather than leaving a half-usable
# worktree, because a silent partial bootstrap reappears as a mystery test
# failure three plans later.
#
# USAGE
#   bash scripts/bootstrap-worktree.sh [worktree_path] [source_repo]
#     worktree_path  defaults to $PWD
#     source_repo    defaults to the main worktree of the same repository
# ---------------------------------------------------------------------------
set -uo pipefail

WT="${1:-$PWD}"
SRC="${2:-}"

fail() { echo "BOOTSTRAP FAILED: $*" >&2; exit 1; }
note() { echo "  $*"; }

# --- resolve paths ---------------------------------------------------------
[ -d "$WT" ] || fail "worktree path does not exist: $WT"
WT="$(cd "$WT" && pwd -P)"

if [ -z "$SRC" ]; then
  # The FIRST entry of `git worktree list` is always the main worktree.
  SRC="$(git -C "$WT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10); exit}')"
fi
[ -n "$SRC" ] || fail "could not resolve the source repo (pass it as arg 2)"
[ -d "$SRC" ] || fail "source repo does not exist: $SRC"
SRC="$(cd "$SRC" && pwd -P)"

[ "$WT" != "$SRC" ] || fail "refusing to bootstrap the MAIN worktree onto itself ($WT)"

echo "Bootstrapping worktree"
echo "  target: $WT"
echo "  source: $SRC"

# --- MAX_PATH guard --------------------------------------------------------
# Measured 2026-08-10: the longest tracked path in this repo is 138 chars. With
# core.longpaths unset (the default), Windows caps total path at 260, so a
# worktree root longer than ~120 chars makes `git worktree add` fail with
# "Could not reset index file to revision 'HEAD'" AFTER checking files out —
# it then rolls the whole worktree back. Catch it here with a clear message.
LONGEST_TRACKED=140
WT_LEN=${#WT}
LONGPATHS="$(git -C "$SRC" config --get core.longpaths || echo false)"
if [ "$LONGPATHS" != "true" ] && [ "$WT_LEN" -gt $((260 - LONGEST_TRACKED)) ]; then
  fail "worktree root is ${WT_LEN} chars; with core.longpaths=false and a ${LONGEST_TRACKED}-char
  longest tracked path, Windows MAX_PATH (260) will be exceeded. Use a SHORT base such as
  C:/gsd-wt/<name>, or enable: git config core.longpaths true"
fi

# --- junction helper (Windows) --------------------------------------------
# PowerShell's New-Item -ItemType Junction is used deliberately: `cmd //c mklink /J`
# has its /J switch mangled by MSYS path conversion under Git Bash (measured).
link_dir() {
  local rel="$1" target="$SRC/$1" dest="$WT/$1"
  [ -d "$target" ] || fail "source missing: $target (run the normal local setup in $SRC first)"
  if [ -e "$dest" ]; then note "already present, skipped: $rel"; return 0; fi
  mkdir -p "$(dirname "$dest")"
  local wt_win src_win
  wt_win="$(cygpath -w "$dest" 2>/dev/null || echo "$dest")"
  src_win="$(cygpath -w "$target" 2>/dev/null || echo "$target")"
  powershell.exe -NoProfile -NonInteractive -Command \
    "New-Item -ItemType Junction -Path '$wt_win' -Target '$src_win' -ErrorAction Stop | Out-Null" \
    >/dev/null 2>&1 \
    || fail "could not create junction $rel (target: $target)"
  [ -e "$dest" ] || fail "junction reported success but $dest does not exist"
  note "junctioned: $rel"
}

copy_file() {
  local rel="$1" target="$SRC/$1" dest="$WT/$1"
  if [ ! -f "$target" ]; then note "source absent, skipped (optional): $rel"; return 0; fi
  if [ -f "$dest" ]; then note "already present, skipped: $rel"; return 0; fi
  mkdir -p "$(dirname "$dest")"
  cp "$target" "$dest" || fail "could not copy $rel"
  note "copied: $rel"
}

link_dir  "backend/venv"
link_dir  "frontend/node_modules"
copy_file "backend/.env"
copy_file "frontend/.env.local"

# --- per-worktree vite cache ----------------------------------------------
# node_modules is SHARED via the junction, and vite writes node_modules/.vite +
# .vite-temp inside it. Two worktrees building at once would race on that cache,
# so each worktree gets its own, honoured by frontend/vite.config.ts.
mkdir -p "$WT/.vite-cache"
note "vite cache dir: .vite-cache (set VITE_CACHE_DIR when running vite/vitest)"

# --- verify, do not assume -------------------------------------------------
echo "Verifying..."
PY="$WT/backend/venv/Scripts/python.exe"
[ -x "$PY" ] || PY="$WT/backend/venv/bin/python"
[ -x "$PY" ] || fail "no python interpreter reachable through the venv junction"
"$PY" -c "import sys; sys.exit(0)" >/dev/null 2>&1 \
  || fail "python is present but will not execute through the junction"
note "python executes through the junction"

[ -d "$WT/frontend/node_modules/vite" ] || fail "node_modules junction has no vite/ — is the source install complete?"
note "node_modules resolves"

[ -f "$WT/backend/.env" ] && note ".env present" || note ".env absent (backend DB/crypto tests will fail — expected only if the source lacks one)"

echo "BOOTSTRAP OK"
echo
echo "Run verification from this worktree with:"
echo "  cd \"$WT/backend\"  && venv/Scripts/python.exe -m pytest tests/unit -q"
echo "  cd \"$WT/frontend\" && VITE_CACHE_DIR=\"$WT/.vite-cache\" npx tsc -p tsconfig.app.json --noEmit"
