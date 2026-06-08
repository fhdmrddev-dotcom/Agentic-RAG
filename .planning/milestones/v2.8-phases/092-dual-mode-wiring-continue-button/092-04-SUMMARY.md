---
phase: 092-dual-mode-wiring-continue-button
plan: 04
status: code_complete_uat_failed
tasks_total: 4
tasks_complete: 3
checkpoint: Task 4 (Chrome MCP lived-experience UAT) — FAILED, gap-closure routed to 092-05
requirements: [MODE-01, MODE-02, CONT-01]
commits:
  - 9fe94d26  # Task 1 — api.ts client methods + cap_paused SSE + kickoff field
  - ca09c90d  # Task 2 — per-thread keyed workflow-lock state + selector (SC#3)
  - fcb825b5  # Task 3 — Deep/Harness toggle + workflow picker + disable-while-locked + Continue card
  - 767948b1  # STATE in-progress marker
---

# 092-04 SUMMARY — Frontend dual-mode wiring + Continue button

## What shipped (Tasks 1-3, committed)
- **api.ts** (`9fe94d26`): `getThreadWorkflow`, `continueRun`, `listPublishedWorkflows`, `cap_paused` SSE callback, kickoff field on the send payload.
- **Per-thread keyed lock** (`ca09c90d`): `workflowLockByThread` Map in `streamsStore`/`StreamsProvider` (copy-then-mutate, GC delete-key, no global boolean — SC#3) + `useMessages` selector.
- **Composer UI** (`fcb825b5`): Deep/Harness toggle (`workflow-mode-selector`), published-workflow picker (`workflow-picker`), Send gating, inline Continue card on `cap_paused`, mount-time `getThreadWorkflow` reconcile.

Build: `vite build` clean; `tsc -b` = 54-error pre-existing baseline (zero net new).

## Task 4 — Chrome MCP lived-experience UAT: **FAILED**
Full evidence in `092-04-UAT-FINDINGS.md`. Summary:

**Verified working live:** MODE-01 toggle + picker (4 published workflows) + Send gating;
MODE-01 atomic workflow-run creation (INSERT workflow_runs + phases + thread anchor + lock;
correct `ThreadWorkflowState` reconcile) — **the workflow-start trigger that unblocks 091's
parked cross-provider UAT now fires**; MODE-02 server-side 409 lock-refusal.

**Findings (→ 092-05 gap closure):**
- **F1 CRITICAL** — `write_audit` omits `user_id`; `harness_audit.user_id` is NOT NULL; `workflow_runs` has no `user_id` column and `create_workflow_run` never persists one. First audit write (`run_started`) throws `NotNullViolationError` → run dies before any phase → empty assistant, no tool calls, no workspace (operator-observed + screenshot). Harness mode is end-to-end non-functional. Missed in 091 because the audit write was mock-only; 092 is the first live run.
- **F2 HIGH** — on that failure `workflow_runs.status` stays `active` → thread stuck `locked`/`lock_is_stale:false`; no UI recovery.
- **F3 MEDIUM (UX)** — client-side composer (toggle, agent selector, textarea, Send) not disabled-while-locked on the active thread; 409'd message added optimistically with no error toast + orphaned assistant placeholder.

**Blocked/untested by F1:** SC#5 reload-reconcile + Stop-unlock, SC#2 DB-NULL after cancel/completion, CONT-01 cap-drive, SC#10 cross-provider scoreboard.

## Requirements
MODE-01 / MODE-02 / CONT-01 NOT marked complete — MODE-01 run-execution and CONT-01 are
blocked by F1; closure deferred to post-092-05 verification.

## Deviations / notes
- The picker is data-dependent: an empty `workflow_definitions` (or rows not visible to the
  backend pool at startup) shows the correct "No published workflows yet" empty state. Seed
  rows (migration 061) must be present for the picker to populate.
- Pre-existing `tsc` baseline + dead import logged in `deferred-items.md` (out of scope).
