---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 01-backend-lifecycle-split
subsystem: backend/runs-lifecycle, db/runs-table, sse/terminal-types
tags: [phase-066, lifecycle, timeouts, runs-table, sse, partition-guard]
status: complete
dependency_graph:
  requires:
    - "supabase/migrations/035_runs_table.sql (creates runs table + 4-value CHECK auto-named runs_status_check)"
    - "backend/app/api/threads.py:79-94 (existing TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE namespace, Phase 061)"
    - "backend/app/api/threads.py:2140-2159 (existing terminal classification block, Phase 061 CR-01 fix)"
  provides:
    - "5-value runs.status enum at DB level (live local DB + supabase/full-schema.sql)"
    - "Pydantic MessageResponse.run_status Literal with 'timed_out'"
    - "SSE TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE with 'timed_out'"
    - "Producer's TimeoutError → status='timed_out' partition (D-066-05)"
    - "runs.error format 'failed: <ExceptionClass>: <truncated≤200chars>' (T-066-02 mitigation)"
  affects:
    - "Phase 066 Plan 02 (per-LLM-call timer wrap — refines the static 'timed_out: per-call deadline exceeded' string with per_call_budget/iteration/_model_id values)"
    - "Phase 066 Plan 03 (frontend onTerminal routing for type='timed_out' SSE events)"
    - "Phase 066 Plan 04 (integration tests asserting partition guard: TimeoutError → 'timed_out', DELETE → 'cancelled')"
tech-stack:
  added: []
  patterns:
    - "Single-statement DROP+ADD CHECK constraint replacement (Postgres atomic ALTER TABLE)"
    - "Prefix-discriminated plain-text runs.error format (D-066-07): 'timed_out: ...', 'failed: <Class>: <msg>', NULL for cancelled"
    - "200-char str(e) truncation cap (T-066-02 mitigation against traceback / API-key-fragment leakage via RLS-readable column)"
key-files:
  created:
    - "supabase/migrations/038_runs_timed_out_status.sql"
  modified:
    - "supabase/full-schema.sql (regenerated from live DB post-apply via scripts/regenerate-full-schema.sh — runs.status CHECK now lists 5 values)"
    - "backend/app/models/message.py (line 38-44 — Literal extended 4 → 5 values + 6-line comment block referencing D-066-04 partition guard)"
    - "backend/app/api/threads.py (lines 81-99 — TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE extended; lines 2140-2173 — TimeoutError/CancelledError/Exception branches rewritten)"
decisions:
  - "Worktree mechanics forced a Plan-Task-3 split into TWO commits: Task 1 commit (migration + code) landed as `9d967af`; the regenerated `supabase/full-schema.sql` landed in a separate Task 3 commit `68e1897` after the user manually applied migration 038 via Supabase Studio SQL editor. Net effect: two commits instead of the plan's intended single commit, with no semantic loss — the split mirrors the actual sync-with-live-DB boundary (regen script reads the live DB which only has the 5-value CHECK after the user pastes 038 in)."
  - "TimeoutError branch comment retains forward-pointer to Plan 02 ('Plan 01 placeholder — Plan 02 will refine'); the static error string 'timed_out: per-call deadline exceeded' is intentionally informationally-minimal so Plan 02 can replace it without behavior change."
  - "Exception branch keeps existing logger.exception() — no logging behavior change, only the runs.error format string changes."
  - "Task 3 commit subject deviates from the PLAN's `<action>` HEREDOC (which combined all 4 files under one `feat(066-01): add 'timed_out' ...`). The actual landed pair is: 9d967af `feat(066-01): add 'timed_out' lifecycle state ...` + 68e1897 `feat(066-01): regenerate full-schema.sql with timed_out CHECK constraint`. Both subjects scope to `066-01`."
metrics:
  duration: "~6 minutes (Task 1) + ~2 minutes (Task 3 commit + SUMMARY finalize) — total ~8 minutes excluding human-action checkpoint wait"
  completed_date: "2026-05-06"
  tasks_in_plan: 3
  tasks_completed: 3
  commits_landed: 2  # 9d967af (Task 1 code) + 68e1897 (Task 3 full-schema)
---

# Phase 066 Plan 01: Backend Lifecycle Split — Summary

5-value `public.runs.status` enum (`streaming`, `completed`, `failed`, `cancelled`, `timed_out`) wired end-to-end: live DB CHECK constraint flipped (post-user-apply), Pydantic Literal mirrored, producer's terminal classification rewritten so TimeoutError → `'timed_out'` (NOT `'failed'`), SSE wire-format adds `'timed_out'`, and `supabase/full-schema.sql` regenerated to match. `runs.py:cancel_run` deliberately UNCHANGED — partition guard (T-066-01) intact.

## Status

**Complete.** All 3 plan tasks landed:

- **Task 1** (`9d967af`): Migration 038 authored, Pydantic Literal extended, SSE namespace extended, terminal classification rewritten.
- **Task 2** (human-action checkpoint): User applied migration 038 via Supabase Studio SQL editor (CLAUDE.md rule: never `db push` / `db reset`); reply was `applied`. Smoke-test INSERT with `status='timed_out'` succeeded against the live DB.
- **Task 3** (`68e1897`): `supabase/full-schema.sql` regenerated from the live DB via `scripts/regenerate-full-schema.sh` (the orchestrator pre-staged the regen output into the worktree; this agent committed it).

## What changed

### Files created

- `supabase/migrations/038_runs_timed_out_status.sql` — single-transaction `DROP CONSTRAINT runs_status_check, ADD CONSTRAINT runs_status_check CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'))` ALTER TABLE. Header comments document D-066-04 / D-066-08 (forward-only, no retroactive classification), the auto-name verification SELECT, and Postgres atomic ALTER TABLE multi-action behavior.

### Files modified

- `supabase/full-schema.sql` — regenerated against the live local DB after migration 038 applied. Diff: 3 insertions / 3 deletions covering the `runs.status` CHECK constraint definition. Token `'timed_out'` now appears in the file (1 occurrence in the runs CHECK).
- `backend/app/models/message.py` (line 39 → lines 38-44): `MessageResponse.run_status` Pydantic `Literal` extended from 4 → 5 values; 6-line comment block above the field documents the partition guard (system-only write source, never from `runs.py:cancel_run`).
- `backend/app/api/threads.py`:
  - Lines 81-99: `TERMINAL_TYPES` frozenset extended from 3 → 4 wire-format types; `_RUN_STATUS_TO_TERMINAL_TYPE` dict extended from 3 → 4 rows (`'timed_out': 'timed_out'`, comment cites D-066-06).
  - Lines 2140-2173: `except asyncio.TimeoutError` branch now writes `_terminal_status = "timed_out"` (was `"failed"`) with stable static prefix `"timed_out: per-call deadline exceeded"` (Plan 02 will refine to include `per_call_budget` / `iteration` / `_model_id`). `except asyncio.CancelledError` UNCHANGED — keeps `_terminal_status = "cancelled"`, `_terminal_error = None`, re-raises (Pitfall 3 invariant). `except Exception as e` extends format to `f"failed: {type(e).__name__}: {_truncated_msg}"` with `[:200]` cap on `str(e)` (T-066-02 traceback-leakage mitigation).

### Files deliberately NOT modified

- `backend/app/api/runs.py` — `cancel_run` continues to write `status="cancelled"`, `error="cancelled_by_user"` (T-066-01 partition guard intact). Verified via grep: no occurrence of `timed_out` in `runs.py`.
- `backend/app/api/threads.py:855` — outer `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper. Plan 02 owns deletion of that wrapper and the per-call timer wrapping at lines 1149-1244. Plan 01 only changes terminal classification + sentinel namespace.

## Migration applied

User reply to checkpoint: `applied`. Sequence executed by user against the live local Supabase DB (CLAUDE.md project rule — never `db push`/`db reset`):

1. Pasted `supabase/migrations/038_runs_timed_out_status.sql` into Supabase Studio SQL editor → `Success. No rows returned.`
2. (Smoke test) `BEGIN; INSERT INTO public.runs (... status='timed_out' ...); ROLLBACK;` → `INSERT 0 1` then `ROLLBACK` (CHECK constraint admits the new value).
3. `bash scripts/regenerate-full-schema.sh` → `supabase/full-schema.sql` updated (1531 lines; `'timed_out'` token appears once in the runs CHECK).

The orchestrator copied the regenerated file into this worktree and the continuation agent (this run) committed it as `68e1897`.

## Verification

### Task 1 / Task 3 grep gates (run on worktree files post-Task-3 commit)

| Gate | Result |
|------|--------|
| Migration file exists | PASS |
| 5-value CHECK present in 038 | PASS |
| `DROP CONSTRAINT runs_status_check` clause present | PASS |
| Pydantic `Literal[...]` 5-value form present | PASS |
| `_RUN_STATUS_TO_TERMINAL_TYPE` includes `"timed_out": "timed_out"` | PASS |
| `TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})` | PASS |
| TimeoutError branch sets `_terminal_status = "timed_out"` | PASS |
| Exception branch uses extended format `f"failed: {type(e).__name__}: {_truncated_msg}"` | PASS |
| `supabase/full-schema.sql` contains `'timed_out'` (post-regen) | PASS |
| `runs.py` partition guard intact (no `timed_out` written from cancel handler) | PASS |

### Live-DB checks (performed by user during Task 2 checkpoint)

| Check | Result |
|-------|--------|
| Migration 038 ran cleanly via Supabase Studio SQL editor | PASS (user replied `applied`) |
| `pg_get_constraintdef` shows 5-value CHECK | PASS (per Task 2 step 5 — confirmed by user) |
| Smoke INSERT with `status='timed_out'` succeeds (then ROLLBACK) | PASS (per Task 2 step 6) |

### Pydantic / import smoke (Task 1)

| Check | Result |
|-------|--------|
| `python -c "import ast; ast.parse(open('app/api/threads.py').read())"` | PASS |
| Pydantic constructor `MessageResponse(... run_status='timed_out')` accepted | PASS |
| `from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE; assert 'timed_out' in TERMINAL_TYPES` | PASS |

## Self-Check: PASSED

- `supabase/migrations/038_runs_timed_out_status.sql` (worktree path) — FOUND
- `supabase/full-schema.sql` (worktree path) — FOUND with `'timed_out'` token (post-regen)
- `backend/app/models/message.py` (worktree path) — FOUND with 5-value Literal
- `backend/app/api/threads.py` (worktree path) — FOUND with `frozenset({"done", "error", "cancelled", "timed_out"})` and `_terminal_status = "timed_out"`
- Commit `9d967af` — FOUND on `worktree-agent-a3972f70f9e63291c` branch (subject: `feat(066-01): add 'timed_out' lifecycle state ...`)
- Commit `68e1897` — FOUND on `worktree-agent-a3972f70f9e63291c` branch (subject: `feat(066-01): regenerate full-schema.sql with timed_out CHECK constraint`)
- All 10 grep gates above returned PASS at SUMMARY-write time.

## Deviations from Plan

### [Rule 3 — Blocking] Worktree-path correction during Task 1

- **Found during:** Task 1 (after completing all edits)
- **Issue:** Initial Write/Edit tool calls used absolute paths to `C:/Vibe Apps/Agentic RAG/...` (the main repo), not the worktree at `C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a3972f70f9e63291c/...`. The system-reminder `Working directory:` field correctly identified the worktree, but absolute paths bypass the cwd hint. Result: edits landed on `v2.5-dev` branch's working tree (the main repo), and the worktree branch saw nothing.
- **Fix:** (1) Re-applied byte-identical edits to the three worktree files via Write/Edit at the worktree path. (2) Reverted the main-repo working tree for these three files only (path-specific `git checkout -- <file>` for the two modified files; `rm` for the untracked migration). Did NOT use blanket `git checkout .` / `git restore .` / `git clean` per the destructive-git prohibition. (3) Verified via `git status --short` that the main repo is clean for these three files and the worktree shows the expected `M`/`A` triple.
- **Files reverted in main repo:** `backend/app/api/threads.py`, `backend/app/models/message.py`, `supabase/migrations/038_runs_timed_out_status.sql` (deleted)
- **Files re-applied in worktree:** same three files — all 8 grep gates pass and `ast.parse` is clean.
- **Commit:** `9d967af` (worktree branch only)

### [Rule 3 — Blocking] Task 3 split into a separate commit

- **Found during:** Task 1 commit planning, given the `checkpoint:human-action` between Task 1 and Task 3.
- **Issue:** Plan Task 3 wanted a single commit containing the migration file, regenerated `supabase/full-schema.sql`, and the two code files. But `full-schema.sql` is generated by `bash scripts/regenerate-full-schema.sh` reading the **live** local DB schema, which is only updated AFTER the user manually applies migration 038 in Supabase Studio (Task 2 checkpoint). Combining all four files in a single commit is impossible until the user finishes the checkpoint.
- **Fix:** Committed Task 1's three files (`9d967af`) without `full-schema.sql`. The continuation agent (this run) committed the regenerated `supabase/full-schema.sql` separately as `68e1897` after the user replied `applied`. Both commit subjects scope to `066-01` so the merge log reads cleanly.
- **Net effect:** Two commits instead of one. No semantic loss — the split commit boundary mirrors the actual sync-with-live-DB boundary.

## Known Stubs

None. The static `"timed_out: per-call deadline exceeded"` error string is **not** a stub — it's an intentional Plan-01-stable message that Plan 02 will refine once `per_call_budget` / `iteration` / `_model_id` come into scope at the per-call timer site. The `(str(e) or "")[:200]` cap is **not** a stub — it's the T-066-02 mitigation per D-066-07.

## Threat Flags

None. Plan 01 introduces no new network endpoints, auth paths, file access patterns, or schema changes outside the modeled `<threat_model>`. The migration's CHECK constraint flip is the modeled change; the producer's terminal classification rewrite is the modeled change; both are mitigated per the threat register (T-066-01 partition guard via untouched `runs.py`, T-066-02 leakage cap at `[:200]`).

## Plan 02 prerequisite reminder

The static placeholder error string at `threads.py` (`_terminal_error = "timed_out: per-call deadline exceeded"`) MUST be refined by Plan 02 once `per_call_budget`, `iteration`, and `_model_id` are in scope at the per-call timer site (D-066-07 target format: `f"timed_out: {per_call_budget}s per-call deadline exceeded at iteration {iteration} (model={_model_id})"`). The `logger.warning` Plan-02-pointer comment in this branch makes the dependency explicit.

## Commits landed (this plan)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | `9d967af` | `feat(066-01): add 'timed_out' lifecycle state — DB CHECK + Pydantic Literal + producer terminal classification` |
| 3 | `68e1897` | `feat(066-01): regenerate full-schema.sql with timed_out CHECK constraint` |

(SUMMARY.md doc commits are tracked separately by the orchestrator's wave-merge.)
