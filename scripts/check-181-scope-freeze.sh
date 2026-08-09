#!/usr/bin/env bash
# ============================================================================
# check-181-scope-freeze.sh — prove the v3.6 revert scope-freeze (Phase 181).
# ============================================================================
# Why this exists (Phase 181 / REVERT-01/02, decisions D-181-05 + D-181-08):
#   Phase 181 installs a governed, provably-tested OFF switch for the ENTIRE
#   v3.6 visual-canvas layer BEFORE any canvas code exists (operator HARD gate
#   #1 — preserve-v1/revert). "Flag-off is byte-identical to today" is only
#   credible if the phase diff DEMONSTRABLY does NOT touch the two shipped
#   authoring doors, the developer run surface, or the harness engine — and
#   ships NO migration and NO new package. This script makes that a mechanical,
#   re-runnable gate instead of a prose promise: it diffs the phase-start ref to
#   HEAD and FAILS (exit 1, naming each offender) if any FROZEN path or any
#   migration / dependency-manifest appears in the diff. It is the project's
#   standing D-14 "confirmed-absent-from-the-phase-diff" technique, scripted.
#
#   Structural sibling: scripts/check-deploy-drift.sh (same strict-bash mode +
#   why/usage/notes header + colored ok/FAIL helpers + non-zero-exit-on-drift).
#
# The two frozen invariants:
#   A. FROZEN CONTRACTS (D-181-08) — the two authoring doors + the run surface +
#      the harness engine MUST be absent from the 181 phase diff:
#        frontend/src/components/workflows/WorkflowDoorSwitch.tsx  (the two doors)
#        frontend/src/pages/WorkflowBuilderPage.tsx                (Author & govern)
#        frontend/src/pages/WorkflowsPage.tsx                      (library / launch)
#        frontend/src/components/panel/PhaseTimeline.tsx           (run surface)
#        frontend/src/components/panel/PhaseCard.tsx               (run surface)
#        backend/app/services/harness_engine.py                    (the ONLY executor)
#        backend/app/services/harness/**                           (harness package)
#        backend/app/models/harness.py                             (harness model)
#   B. NO MIGRATION / NO PACKAGE (D-181-05) — the 181 revert foundation is a
#      JSONB-key + code cold-default only: no supabase/migrations/*.sql and no
#      package.json / package-lock / requirements.txt delta in the phase diff.
#
# Usage:
#   bash scripts/check-181-scope-freeze.sh [BASE_REF] [HEAD_REF]
#     BASE_REF  the phase-start ref (default: the commit that last touched
#               181-PATTERNS.md — a stable, reproducible proxy that PRECEDES the
#               first 181 code commit; only planning-doc commits sit between it
#               and the first code commit, so it is safe for a scope diff).
#     HEAD_REF  the ref to diff to (default: HEAD). At live milestone-close,
#               PIN this to the 181 phase-end ref so LATER phases that
#               legitimately touch the run surface / doors (184 WorkflowBuilderPage,
#               188 PhaseTimeline/PhaseCard) are not misread as 181 scope creep.
#
# Notes:
#   - Matches by PATH against `git diff --name-only` (never greps file CONTENT),
#     so a mere comment mentioning a frozen file is not a false offender.
#   - Exit 0 + "scope-freeze OK" on a clean diff; exit 1 naming every offender.
# ============================================================================

set -euo pipefail

# Run from the repo root regardless of caller cwd (so relative paths resolve).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PATTERNS_DOC=".planning/phases/181-revert-foundation/181-PATTERNS.md"

# ── resolve the base + head refs ──────────────────────────────────────────────
DEFAULT_BASE="$(git rev-list -1 HEAD -- "$PATTERNS_DOC" 2>/dev/null || true)"
BASE="${1:-$DEFAULT_BASE}"
HEAD_REF="${2:-HEAD}"

if [ -z "$BASE" ]; then
  echo "FATAL: could not derive a phase-start ref (pass one explicitly as \$1)." >&2
  echo "       tried: git rev-list -1 HEAD -- $PATTERNS_DOC" >&2
  exit 2
fi
if ! git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null; then
  echo "FATAL: BASE ref '$BASE' is not a valid commit." >&2
  exit 2
fi
if ! git rev-parse --verify --quiet "${HEAD_REF}^{commit}" >/dev/null; then
  echo "FATAL: HEAD ref '$HEAD_REF' is not a valid commit." >&2
  exit 2
fi

# ── the FROZEN paths (D-181-08) — grep -E patterns against the changed list ───
FROZEN=(
  '(^|/)WorkflowDoorSwitch\.tsx$'
  '(^|/)WorkflowBuilderPage\.tsx$'
  '(^|/)WorkflowsPage\.tsx$'
  '(^|/)PhaseTimeline\.tsx$'
  '(^|/)PhaseCard\.tsx$'
  '^backend/app/services/harness_engine\.py$'
  '^backend/app/services/harness/'
  '^backend/app/models/harness\.py$'
)

# ── migration / package-manifest patterns (D-181-05) ──────────────────────────
NO_SHIP=(
  '^supabase/migrations/.*\.sql$'
  '(^|/)package\.json$'
  '(^|/)package-lock\.json$'
  '(^|/)pnpm-lock\.yaml$'
  '(^|/)yarn\.lock$'
  '(^|/)requirements\.txt$'
  '(^|/)requirements-[A-Za-z0-9._-]+\.txt$'
)

RED=$'\033[31m'; GRN=$'\033[32m'; RST=$'\033[0m'
offenders=()

CHANGED="$(git diff --name-only "$BASE".."$HEAD_REF")"

echo "=============================================================="
echo " Phase 181 revert scope-freeze (D-181-08 doors/harness + D-181-05 no-ship)"
echo " repo: $REPO_ROOT"
echo " diff: ${BASE} .. ${HEAD_REF}"
echo "=============================================================="

check_group() {
  # $1 = human label ; remaining args = regex patterns
  local label="$1"; shift
  local pat hit
  local found=0
  for pat in "$@"; do
    # match by PATH only (against the changed-file list), never file content
    hit="$(printf '%s\n' "$CHANGED" | grep -E "$pat" || true)"
    if [ -n "$hit" ]; then
      found=1
      while IFS= read -r f; do
        [ -z "$f" ] && continue
        printf '  %sFROZEN%s  [%s] %s\n' "$RED" "$RST" "$label" "$f"
        offenders+=("$f")
      done <<< "$hit"
    fi
  done
  if [ "$found" -eq 0 ]; then
    printf '  %sok%s     %s — none present in the phase diff\n' "$GRN" "$RST" "$label"
  fi
}

check_group "D-181-08 doors/run-surface/harness" "${FROZEN[@]}"
check_group "D-181-05 no-migration/no-package"    "${NO_SHIP[@]}"

echo "--------------------------------------------------------------"
if [ "${#offenders[@]}" -gt 0 ]; then
  echo "RESULT: SCOPE-FREEZE VIOLATED (${#offenders[@]} offending path(s))."
  echo "        The 181 revert must NOT touch the two authoring doors, the run"
  echo "        surface, the harness engine, any migration, or any dependency"
  echo "        manifest (D-181-05 / D-181-08). Remove them from the phase diff."
  exit 1
fi

echo "scope-freeze OK"
exit 0
