---
phase: 092-dual-mode-wiring-continue-button
plan: 04
artifact: uat-findings
status: gaps_found
source: Chrome MCP lived-experience UAT (Task 4 checkpoint, orchestrator-driven)
date: 2026-05-31
tester: orchestrator (Chrome DevTools MCP) + operator observation
verdict: FAILED — critical blocker; Harness mode end-to-end non-functional
gap_closure_target: 092-05 (planned)
---

# Phase 092 — Wave 4 UAT Findings

Driven live against the running app (backend uvicorn `--reload` single-worker +
`npm run dev` @ localhost:5173, login fhdmrd@gmail.com). Workflow kicked off:
**Research -> Summarize** (research_summarize, 2 phases), thread
`7debba04-13d1-4b3f-9297-8b021e9a87dd`, workflow_run `6497ce6b-23b3-4668-8f46-d466bf884cce`.

## ✅ Verified working (live evidence)

| # | What | Evidence |
|---|------|----------|
| P1 | MODE-01 Deep↔Harness toggle renders; `workflow-mode-selector` testid present | a11y snapshot + screenshot |
| P2 | Workflow picker lists all 4 published workflows | `GET /workflows/published` → 4 rows (Doc Q&A, Literature review, Plan→Execute→Verify, Research→Summarize) |
| P3 | Send gating correct (disabled until Harness + workflow + text) | `composer-send.disabled` toggles true→false only when all three set |
| P4 | MODE-01 run creation: atomic INSERT workflow_runs + phases + thread anchor + lock | `POST /threads/{id}/messages` 201 → `GET /threads/{id}/workflow` = `{mode:harness, locked:true, active_workflow_run_id:6497ce6b…, run_status:active, total_phases:2, lock_is_stale:false, continues_remaining:3}` — **this is the workflow-start trigger that unblocks 091's parked cross-provider UAT** |
| P5 | MODE-02 server-side 409 lock-refusal | Deep "sneak" message to locked thread → `POST /threads/{id}/messages` **409** |

## ❌ Findings (gap-closure spec for 092-05)

### F1 — CRITICAL: every harness_audit write fails → Harness mode end-to-end non-functional
- **Symptom (operator-observed + screenshot):** workflow kicks off, thread locks, but the assistant response is empty — no streamed text, no tool calls, no workspace activity. Both the kickoff run and a second message show empty assistant placeholders.
- **Root cause (4 converging sources):**
  1. Live SSE `run:{run_id}` stream error: `failed: NotNullViolationError: null value in column "user_id" of relation "harness_audit" violates not-null constraint`.
  2. `backend/app/db/workflows.py:472` — `write_audit` INSERT is `INSERT INTO harness_audit (run_id, event_type, metadata) VALUES ($1,$2,$3::jsonb)` — **omits `user_id`**.
  3. `harness_audit.user_id` is `NOT NULL` (full-schema.sql) with no default → the very first audit write (`run_started`) raises → run marked `failed` before any phase executes.
  4. There is no source for the user id anyway: `workflow_runs` has **no `user_id` column** (full-schema.sql workflow_runs def), `create_workflow_run` (db/workflows.py:96-106) does not persist one, and `harness_engine.py:574` reads `run.get("user_id")` → `None`.
- **Why 091 missed it:** `write_audit` was only ever exercised against the mock asyncpg pool (no live INSERT INTO workflow_runs existed in `backend/app` before 092). 092 is the first live run — it hits the real NOT NULL constraint immediately.
- **Fix shape (proposed):**
  - Migration: `ALTER TABLE workflow_runs ADD COLUMN user_id uuid` (FK → auth.users / threads.user_id source); backfill from `threads.user_id`. (Apply via SQL editor per CLAUDE.md, regenerate full-schema.sql.)
  - `create_workflow_run`: accept `user_id` (resolved from the owning thread / current_user in the producer branch) and persist it in the workflow_runs INSERT.
  - `write_audit`: accept `user_id` and include it in the INSERT (`INSERT INTO harness_audit (run_id, user_id, event_type, metadata) …`); thread it from `harness_engine` current_user (which reads `run.get("user_id")` — now populated).
  - Add a live-DB integration test (not mock-only) that asserts a `run_started` audit row is actually written for a created run — closes the mock-blind-spot.

### F2 — HIGH: stuck lock with no UI recovery on this failure mode
- When the run dies via F1, `workflow_runs.status` stays `active` (the failure is in the audit/run layer, not the harness engine's normal finish path), so the thread stays `locked:true` and `lock_is_stale:false`.
- `lock_is_stale` keys off `workflow_runs.status` only; it does NOT detect that the underlying `runs` row is `failed`. The thread is wedged — no UI path unlocks it.
- **Fix shape:** (a) the engine/run failure path must move `workflow_runs.status` to a terminal state AND clear `threads.active_workflow_run_id` (reuse 092-03 `finish_run` lock-clear); (b) `lock_is_stale` should also consider the underlying run terminal/missing, not just `workflow_runs.status`.

### F3 — MEDIUM (UX): client-side composer not disabled-while-locked on the active thread
- On the thread with an active locked workflow, the Deep/Harness toggle, the General/Explorer selector, the textarea, and Send all stay **enabled** (`modeSelDisabled:false`, `agentSelDisabled:false`, Send re-enables once text is typed). Plan 092-04 Task 3 spec'd disable-while-locked on both selectors (D-03/D-05).
- The 409'd Deep message is added optimistically to the transcript as a sent bubble with **no error toast**, and leaves an **orphaned empty assistant placeholder**.
- **Fix shape:** derive the lock for the CURRENT thread from the keyed `workflowLockByThread` state and disable toggle + agent selector + composer with a tooltip; on a 409 send, surface a toast and roll back the optimistic user/assistant bubbles.

## Blocked / untested (gated by F1 — no workflow can complete)
- SC#5 reload-reconcile + Stop-unlock
- SC#2 DB-NULL anchor after cancel AND after natural completion
- CONT-01 cap-drive → Continue card → dropped-tool re-run → 3-cap refusal
- SC#10 native-7 × multi-tool × parallel-thread × long-message cross-provider scoreboard (operator-owned; deferred until F1 fixed)

## Cleanup note
Thread `7debba04…` is left in a stuck-locked state (F2) — operator may clear its
`threads.active_workflow_run_id` manually or it resolves once F1+F2 ship.
