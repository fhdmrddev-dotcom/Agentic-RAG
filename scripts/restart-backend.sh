#!/usr/bin/env bash
# Restart the local backend uvicorn process (POSIX / WSL / macOS / Linux).
#
# Phase 075.4 Plan 05 — FORWARD-REF #2: update for `--workers N` when Phase 079
# enables multi-worker readiness (D-PRD-12 supersedes D-v2.5-02). Currently
# assumes single-worker per CLAUDE.md project rule.
#
# What this does:
#   [1] pkill any running `uvicorn ... app.main:app` (POSIX process matching)
#   [2] sleep 2s — give the OS time to release port 8000 + close file handles
#   [3] cd backend, source venv, relaunch uvicorn detached with nohup
#
# Usage:
#   bash scripts/restart-backend.sh
#
# Logs land in /tmp/uvicorn.log so the script can return immediately while
# the backend keeps running. Tail with `tail -f /tmp/uvicorn.log` if needed.

set -euo pipefail

# Kill any running uvicorn for app.main:app. `|| true` prevents non-zero exit
# when nothing matches (set -e would otherwise abort the script).
pkill -f 'uvicorn.*app.main:app' 2>/dev/null || true
sleep 2

# Relaunch from the backend dir so relative imports + .env resolution work.
cd "$(dirname "$0")/../backend"
# shellcheck disable=SC1091
source venv/bin/activate
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
    > /tmp/uvicorn.log 2>&1 &

echo "Backend restarted; logs: /tmp/uvicorn.log"
