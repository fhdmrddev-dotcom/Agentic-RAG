---
phase: 079-d-v2-5-02-supersession-multi-worker-enable
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - CLAUDE.md
  - backend/.env.example
  - backend/app/api/threads.py
  - backend/app/db/runs.py
  - scripts/restart-backend.ps1
  - supabase/migrations/052_runs_worker_id.sql
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 079: Code Review Report

**Reviewed:** 2026-05-27
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 079 enables multi-worker uvicorn (D-PRD-12 superseding D-v2.5-02). The changeset is small and well-structured: a new nullable `spawned_by_worker` column via migration 052, PID wiring at the `insert_run` call site in `threads.py`, the `restart-backend.ps1` script branching between `--reload` (single-process dev) and `--workers N` (production), and the CLAUDE.md/`.env.example` documentation updates.

No critical issues found. The migration is safe (nullable `ALTER TABLE ADD COLUMN IF NOT EXISTS`), the SQL uses parameterized queries (no injection risk), and the `os` module was already imported. Two warnings and two informational items are noted below.

## Warnings

### WR-01: PowerShell [int] cast of WORKER_COUNT has no error handling for non-numeric input

**File:** `scripts/restart-backend.ps1:94`
**Issue:** The expression `[int]$env:WORKER_COUNT` will throw a terminating error if the env var contains a non-numeric string (e.g., `WORKER_COUNT=auto` or a typo like `WORKER_COUNT=2w`). While `$ErrorActionPreference = "Stop"` prevents silent continuation, the error message from PowerShell's type coercion is cryptic (`Cannot convert value "auto" to type "System.Int32"`). This is a minor robustness gap -- a developer who typos the value gets an unhelpful error with no hint about which variable failed or what valid values are.

**Fix:** Add a try/catch around the parse with a clear error message, or use `[int]::TryParse`:
```powershell
$WorkerCount = 2  # default
if ($env:WORKER_COUNT) {
    $parsed = 0
    if ([int]::TryParse($env:WORKER_COUNT, [ref]$parsed)) {
        $WorkerCount = $parsed
    } else {
        Write-Error "WORKER_COUNT='$($env:WORKER_COUNT)' is not a valid integer. Use a number 1-16."
        exit 1
    }
}
```

### WR-02: Multi-worker mode (WORKER_COUNT > 1) loses --reload, making local dev require manual restarts

**File:** `scripts/restart-backend.ps1:100-116`
**Issue:** The `.env.example` ships `WORKER_COUNT=2` as the default. A developer who copies `.env.example` to `.env` (standard onboarding flow) and uses `restart-backend.ps1` will get multi-worker mode without `--reload`. This means code changes during development require manually re-running the restart script. The comment explains the uvicorn incompatibility (`--reload` vs `--workers > 1`), but the default experience for a new developer is degraded -- they silently lose hot-reload without realizing it.

The CLAUDE.md rule (line 26) says "Multi-worker uvicorn is the default" which is the production intent, but `MEMORY.md` records "User starts the backend uvicorn themselves in a visible terminal" -- the developer workflow appears to be manual starts with `--reload`, not this script. The `.env.example` default should match the most common consumption context.

**Fix:** Consider defaulting `WORKER_COUNT=1` in `.env.example` (dev-first) with a comment noting that production should use 2+. Alternatively, add a `DEV_MODE` or similar flag, or simply document prominently that local dev should override `WORKER_COUNT=1`.
```ini
# Number of uvicorn workers (restart-backend.ps1 only).
# 1 = dev mode (with --reload); 2+ = production (no --reload).
# See D-PRD-12 for scaling guidance.
WORKER_COUNT=1
```

## Info

### IN-01: PID stored as TEXT allows inconsistent formats across platforms

**File:** `backend/app/db/runs.py:35`, `supabase/migrations/052_runs_worker_id.sql:6`
**Issue:** `spawned_by_worker` is typed as `TEXT` and populated via `str(os.getpid())`. On all platforms `os.getpid()` returns an `int`, so `str()` always produces a decimal string. Using `TEXT` rather than `INTEGER` is a deliberate choice (the migration comment says "OS PID"), and it provides flexibility if the column is later repurposed for non-numeric identifiers (e.g., container IDs, Kubernetes pod names). However, if the intent is strictly OS PIDs, an `INTEGER` column would be more type-safe and sortable. This is a minor design note, not a defect.

**Fix:** No action required. If the column should remain flexible for future use (container IDs, etc.), `TEXT` is correct. If it should be strictly numeric PIDs, consider `INTEGER` in a future migration.

### IN-02: Commented-out forward-reference removed cleanly

**File:** `scripts/restart-backend.ps1:1-4`
**Issue:** The old Phase 075.4 forward-reference comment ("FORWARD-REF #2: update for `--workers N` when Phase 079 enables multi-worker readiness") was correctly replaced with the Phase 079 implementation note. This is good hygiene -- the forward-ref debt is now closed. Noted for completeness.

**Fix:** None needed.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
