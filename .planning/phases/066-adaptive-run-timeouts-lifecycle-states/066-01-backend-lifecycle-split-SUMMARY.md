---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 01-backend-lifecycle-split
subsystem: backend/runs-lifecycle, db/runs-table, sse/terminal-types
tags: [phase-066, lifecycle, timeouts, runs-table, sse, partition-guard]
status: paused-at-checkpoint
checkpoint: human-action (Task 2 — manual Supabase SQL editor apply + full-schema regen)
dependency_graph:
  requires:
    - "supabase/migrations/035_runs_table.sql (creates runs table + 4-value CHECK auto-named runs_status_check)"
    - "backend/app/api/threads.py:79-94 (existing TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE namespace, Phase 061)"
    - "backend/app/api/threads.py:2140-2159 (existing terminal classification block, Phase 061 CR-01 fix)"
  provides:
    - "5-value runs.status enum at DB level (post-checkpoint apply)"
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
    - "backend/app/models/message.py (line 38-44 — Literal extended 4 → 5 values + 6-line comment block referencing D-066-04 partition guard)"
    - "backend/app/api/threads.py (lines 81-99 — TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE extended; lines 2140-2173 — TimeoutError/CancelledError/Exception branches rewritten)"
decisions:
  - "Worktree mechanics force a Plan-Task-3 split: Task 1 commit (migration + code) lands in this worktree as `9d967af`; Task 2 (SQL editor apply) is a human checkpoint; Task 3 (full-schema.sql regen + commit) defers to post-checkpoint user action because regen reads the live DB which only has the 5-value CHECK after the user pastes 038 into the Supabase SQL editor. Commit 9d967af's message documents the split."
  - "TimeoutError branch comment retains forward-pointer to Plan 02 ('Plan 01 placeholder — Plan 02 will refine'); the static error string 'timed_out: per-call deadline exceeded' is intentionally informationally-minimal so Plan 02 can replace it without behavior change."
  - "Exception branch keeps existing logger.exception() — no logging behavior change, only the runs.error format string changes."
metrics:
  duration: "~6 minutes (excluding worktree-path-correction overhead noted under Deviations)"
  completed_date: "2026-05-06"
  tasks_in_plan: 3
  tasks_completed_in_this_run: 1
  tasks_pending: 2  # Task 2 = human checkpoint; Task 3 (full-schema commit) folds into the continuation agent's commit after Task 2
  commits_landed: 1
---

# Phase 066 Plan 01: Backend Lifecycle Split — Summary

5-value `public.runs.status` enum (`streaming`, `completed`, `failed`, `cancelled`, `timed_out`) wired end-to-end at the code level (Pydantic + producer + SSE namespace + migration); the DB-side CHECK constraint flip is **paused at a `checkpoint:human-action` task** awaiting the user's Supabase SQL editor apply.

## Status

**Completed:** Task 1 (migration authored, Pydantic Literal extended, SSE namespace extended, terminal classification rewritten — single commit `9d967af`).

**Pending:** Task 2 (`checkpoint:human-action`) — user manually applies migration 038 via Supabase Studio SQL editor (CLAUDE.md rule: never `db push` / `db reset`), then runs `bash scripts/regenerate-full-schema.sh` to refresh `supabase/full-schema.sql` from the live DB. Continuation agent (post-checkpoint) commits `supabase/full-schema.sql` (Task 3, folded into the user-side post-apply step).

## What changed

### Files created

- `supabase/migrations/038_runs_timed_out_status.sql` — single-transaction `DROP CONSTRAINT runs_status_check, ADD CONSTRAINT runs_status_check CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'))` ALTER TABLE. Header comments document D-066-04 / D-066-08 (forward-only, no retroactive classification), the auto-name verification SELECT (line 18-21 of header), and Postgres atomic ALTER TABLE multi-action behavior.

### Files modified

- `backend/app/models/message.py` (line 39 → lines 38-44): `MessageResponse.run_status` Pydantic `Literal` extended from 4 → 5 values; 6-line comment block above the field documents the partition guard (system-only write source, never from `runs.py:cancel_run`).
- `backend/app/api/threads.py`:
  - Lines 81-99: `TERMINAL_TYPES` frozenset extended from 3 → 4 wire-format types; `_RUN_STATUS_TO_TERMINAL_TYPE` dict extended from 3 → 4 rows (`'timed_out': 'timed_out'`, comment cites D-066-06).
  - Lines 2140-2173: `except asyncio.TimeoutError` branch now writes `_terminal_status = "timed_out"` (was `"failed"`) with stable static prefix `"timed_out: per-call deadline exceeded"` (Plan 02 will refine to include `per_call_budget` / `iteration` / `_model_id`). `except asyncio.CancelledError` UNCHANGED — keeps `_terminal_status = "cancelled"`, `_terminal_error = None`, re-raises (Pitfall 3 invariant). `except Exception as e` extends format to `f"failed: {type(e).__name__}: {_truncated_msg}"` with `[:200]` cap on `str(e)` (T-066-02 traceback-leakage mitigation).

### Files deliberately NOT modified

- `backend/app/api/runs.py` — `cancel_run` continues to write `status="cancelled"`, `error="cancelled_by_user"` (T-066-01 partition guard intact). Verified via grep: no occurrence of `timed_out` in `runs.py`.
- `backend/app/api/threads.py:855` — outer `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper. Plan 02 owns deletion of that wrapper and the per-call timer wrapping at lines 1149-1244. Plan 01 only changes terminal classification + sentinel namespace.

## Verification (Task 1 gates passed in worktree)

| Gate | Result |
|------|--------|
| Migration file exists | OK |
| 5-value CHECK present in 038 | OK |
| `DROP CONSTRAINT runs_status_check` clause present | OK |
| Pydantic `Literal[...]` 5-value form present | OK |
| `_RUN_STATUS_TO_TERMINAL_TYPE` includes `"timed_out": "timed_out"` | OK |
| `TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})` | OK |
| TimeoutError branch sets `_terminal_status = "timed_out"` | OK |
| Exception branch uses extended format `f"failed: {type(e).__name__}: {_truncated_msg}"` | OK |
| `runs.py` partition guard intact (no `timed_out` written from cancel handler) | OK |
| `python -c "import ast; ast.parse(open('app/api/threads.py').read())"` parses cleanly | OK |
| Pydantic constructor `MessageResponse(... run_status='timed_out')` accepted | OK (verified once against main-repo copy of byte-identical file before worktree-path-correction; worktree files are byte-equivalent) |
| `from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE; assert 'timed_out' in TERMINAL_TYPES` | OK (same caveat as above) |

## Self-Check: PASSED

- `supabase/migrations/038_runs_timed_out_status.sql` (worktree path) — FOUND
- `backend/app/models/message.py` (worktree path) — FOUND with 5-value Literal at line 44
- `backend/app/api/threads.py` (worktree path) — FOUND with `frozenset({"done", "error", "cancelled", "timed_out"})` and `_terminal_status = "timed_out"`
- Commit `9d967af` — FOUND on `worktree-agent-a3972f70f9e63291c` branch (subject: `feat(066-01): add 'timed_out' lifecycle state ...`)

## Deviations from Plan

### [Rule 3 — Blocking] Worktree-path correction (mid-execution)

- **Found during:** Task 1 (after completing all edits)
- **Issue:** Initial Write/Edit tool calls used absolute paths to `C:/Vibe Apps/Agentic RAG/...` (the main repo), not the worktree at `C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a3972f70f9e63291c/...`. The system-reminder `Working directory:` field correctly identified the worktree, but absolute paths bypass the cwd hint. Result: edits landed on `v2.5-dev` branch's working tree (the main repo), and the worktree branch saw nothing.
- **Fix:** (1) Re-applied byte-identical edits to the three worktree files via Write/Edit at the worktree path. (2) Reverted the main-repo working tree for these three files only (path-specific `git checkout -- <file>` for the two modified files; `rm` for the untracked migration). Did NOT use blanket `git checkout .` / `git restore .` / `git clean` per the destructive-git prohibition. (3) Verified via `git status --short` that the main repo is clean for these three files and the worktree shows the expected `M`/`A` triple.
- **Files reverted in main repo:** `backend/app/api/threads.py`, `backend/app/models/message.py`, `supabase/migrations/038_runs_timed_out_status.sql` (deleted)
- **Files re-applied in worktree:** same three files — all 8 grep gates pass and `ast.parse` is clean.
- **Commit:** `9d967af` (worktree branch only)

### [Rule 3 — Blocking] Task 3 split

- **Found during:** Task 1 commit planning, given the `checkpoint:human-action` between Task 1 and Task 3.
- **Issue:** Plan Task 3 wanted a single commit containing the migration file, regenerated `supabase/full-schema.sql`, and the two code files. But `full-schema.sql` is generated by `bash scripts/regenerate-full-schema.sh` reading the **live** local DB schema, which is only updated AFTER the user manually applies migration 038 in Supabase Studio (Task 2 checkpoint). Combining all four files in a single commit is impossible until the user finishes the checkpoint.
- **Fix:** Committed Task 1's three files (`9d967af`) without `full-schema.sql`. The commit message body explicitly documents this split and points the post-checkpoint user/continuation-agent to run `bash scripts/regenerate-full-schema.sh` and commit the regenerated `supabase/full-schema.sql` as a follow-up.
- **Net effect:** Two commits instead of one. No semantic loss — the split commit boundary mirrors the actual sync-with-live-DB boundary.

## Known Stubs

None. The static `"timed_out: per-call deadline exceeded"` error string is **not** a stub — it's an intentional Plan-01-stable message that Plan 02 will refine once `per_call_budget` / `iteration` / `_model_id` come into scope at the per-call timer site. The `(str(e) or "")[:200]` cap is **not** a stub — it's the T-066-02 mitigation per D-066-07.

## Threat Flags

None. Plan 01 introduces no new network endpoints, auth paths, file access patterns, or schema changes outside the modeled `<threat_model>`. The migration's CHECK constraint flip is the modeled change; the producer's terminal classification rewrite is the modeled change; both are mitigated per the threat register (T-066-01 partition guard via untouched `runs.py`, T-066-02 leakage cap at `[:200]`).

## Continuation instructions for the post-checkpoint agent

After the user replies "applied" to the checkpoint:

1. Verify `supabase/full-schema.sql` has been regenerated (look for `'timed_out'` token) — `grep -c "'timed_out'" supabase/full-schema.sql` should return ≥1.
2. Stage `supabase/full-schema.sql` (and only that file).
3. Commit with this message body:

```
chore(066-01): regenerate supabase/full-schema.sql after migration 038 apply

Companion to 9d967af. User manually applied migration 038 via Supabase
Studio SQL editor (CLAUDE.md rule), then ran scripts/regenerate-full-schema.sh
to refresh the bootstrap artifact. The 5-value runs.status CHECK is now
present in the live DB and reflected in full-schema.sql.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

4. Update `.planning/STATE.md` and `.planning/ROADMAP.md` per `/gsd:execute-phase`-orchestrator post-merge protocol (this worktree-side agent does NOT touch shared artifacts).

## Plan 02 prerequisite reminder

The static placeholder error string at `threads.py:2152` (`_terminal_error = "timed_out: per-call deadline exceeded"`) MUST be refined by Plan 02 once `per_call_budget`, `iteration`, and `_model_id` are in scope at the per-call timer site (D-066-07 target format: `f"timed_out: {per_call_budget}s per-call deadline exceeded at iteration {iteration} (model={_model_id})"`). The `logger.warning` Plan-02-pointer comment in this branch makes the dependency explicit.
