---
phase: 120-collision-fix-context-isolation
plan: 02
subsystem: database
tags: [supabase, postgres, asyncpg, agent-loop, harness, context-isolation, sse, migration]

# Dependency graph
requires:
  - phase: 120-01
    provides: run-scoped sandbox harvest (COLL-01) on the same collision/context-isolation surface
provides:
  - "messages.origin column (authored migration 076 — deep | harness) recording which mode wrote each row"
  - "insert_assistant_message gains an origin: str = 'deep' kwarg — the shared Deep+Harness final-answer persist path"
  - "every enumerated HARNESS message-insert site explicitly tags origin='harness'"
  - "asymmetric, provider-agnostic origin filter (_apply_origin_filter) on the Deep :1024 history-reconstruction query"
affects: [120-03, 130-template_input-resolver, agent_loop, harness_engine, context-isolation, threads]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Asymmetric row-level origin pre-filter as a SINGLE shared WHERE clause (no per-provider fork) — same filtered set feeds every provider"
    - "Server-set enum column (NOT NULL DEFAULT 'deep' + CHECK) — load-bearing default fills legacy rows so neq() avoids the three-valued-logic trap"

key-files:
  created:
    - supabase/migrations/076_messages_origin.sql
    - backend/tests/test_120_origin_filter.py
  modified:
    - backend/app/db/runs.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/phase_types.py
    - backend/app/api/runs.py
    - backend/app/services/agent_loop.py

key-decisions:
  - "Filter logic extracted to module-level pure helper _apply_origin_filter(history_q, agent_mode) — keeps the single agent_loop edit testable in isolation without per-provider forking"
  - "origin kept OUT of the .select() projection (pure WHERE filter) so _reconstruct_history is unchanged and pure-Deep threads return today's exact set (SC#4 byte-identical)"
  - "api/runs.py ask_user_response defaults _origin='deep' and sets 'harness' ONLY on the confirmed workflow_runs-fallback branch (A2 safe-direction)"
  - "Migration 076 AUTHORED only — NOT applied; full-schema.sql untouched (Plan 03 is the BLOCKING operator apply + regenerate)"

patterns-established:
  - "Asymmetric origin filter: Deep/Explorer neq('origin','harness') (replays deep + legacy); Harness eq('origin','harness') (strict defense-in-depth per A1/D-120-06)"
  - "ADDITIVE filter — owner/thread scope (.eq thread_id + .eq user_id) is never relaxed; the new clause only NARROWS within an already-owner-scoped set (V4)"

requirements-completed: [CTX-01]

# Metrics
duration: ~25min
completed: 2026-06-22
---

# Phase 120 Plan 02: Context Isolation (CTX-01) Summary

**`messages.origin` (deep | harness) authored as migration 076, threaded through the shared `insert_assistant_message` helper, tagged at every harness write site, and enforced by an asymmetric provider-agnostic origin filter on the Deep history-reconstruction query — stopping go-forward Deep↔Harness context bleed in a shared thread.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-22
- **Tasks:** 2 (Task 2 was TDD: RED → GREEN)
- **Files modified:** 8 (5 source + 1 migration + 1 test + 1 deferred-items log)

## Accomplishments

- Authored `supabase/migrations/076_messages_origin.sql` — `ADD COLUMN origin text NOT NULL DEFAULT 'deep'` + `CHECK (origin IN ('deep','harness'))`, no new RLS policy (inherits the existing thread-owner policy, precedent 050). The `NOT NULL DEFAULT 'deep'` is load-bearing: it fills every existing row with `'deep'` so the Deep `neq` filter correctly replays legacy rows (no NULL three-valued-logic drop). NOT applied here — Plan 03 applies + regenerates `full-schema.sql`.
- Threaded `origin: str = "deep"` through `insert_assistant_message` (`$10` positional bind) — the shared Deep+Harness final-answer persist path; default keeps every Deep caller correct with no change.
- Tagged every enumerated HARNESS insert site `'harness'`: success persist (harness_engine :439), failure persist (:513), the raw ask_user-expiry SQL INSERT (:225, positional `$4` — never f-stringed), the disposition ask_user prompt (:889), the `llm_human_input` ask_user prompt (phase_types :629), and the mode-aware `api/runs.py` ask_user_response insert.
- Added the asymmetric, provider-agnostic origin filter (`_apply_origin_filter`) at the agent_loop `:1024` history query — Deep/Explorer `neq('origin','harness')`, Harness `eq('origin','harness')` — a single shared WHERE clause with `origin` kept out of the projection and owner/thread scope preserved.
- 14 CTX-01 unit tests (asymmetric filter per mode, SC#4 Deep byte-identical no-op, SC#3/A3 harness-site tagging backstop, Pitfall 4 projection + V4 scope guards) — all GREEN.

## Task Commits

1. **Task 1: Author migration 076 + thread origin through shared helper + tag harness insert sites** — `0b6241ab` (feat)
2. **Task 2 (TDD RED): failing CTX-01 origin-filter tests** — `cf451131` (test)
3. **Task 2 (TDD GREEN): asymmetric provider-agnostic origin filter at the history query** — `ad959761` (feat)

_TDD task: RED (`cf451131`) → GREEN (`ad959761`); no REFACTOR needed (implementation minimal)._

## Files Created/Modified

- `supabase/migrations/076_messages_origin.sql` (created) — additive `origin` enum column + CHECK; idempotent; AUTHORED not applied.
- `backend/app/db/runs.py` — `insert_assistant_message` gains `origin` kwarg + `$10` INSERT bind.
- `backend/app/services/harness_engine.py` — `origin="harness"` at success/failure persists; `origin` column + positional `'harness'` on the raw expiry INSERT; `"origin":"harness"` on the disposition prompt insert.
- `backend/app/services/harness/phase_types.py` — `"origin":"harness"` on the `llm_human_input` ask_user prompt insert.
- `backend/app/api/runs.py` — ask_user_response insert is mode-aware (`_origin` default 'deep'; 'harness' only on the confirmed workflow_runs-fallback branch).
- `backend/app/services/agent_loop.py` — new `_apply_origin_filter` helper + `:1024` history query rebuilt into `_history_q` with the asymmetric filter applied (origin out of `.select`; both owner/thread `.eq` preserved). `_reconstruct_history` unchanged.
- `backend/tests/test_120_origin_filter.py` (created) — 14 tests across the 4 CTX-01 must-haves.

## Decisions Made

- Extracted the filter into a module-level pure helper `_apply_origin_filter` so the single agent_loop edit is testable in isolation via a fluent query-builder spy, without forking the shared path.
- `origin` deliberately kept out of the `.select()` projection — a pure WHERE filter — so `_reconstruct_history` needs no change and the Deep byte-identical guarantee holds.
- Left `api/threads.py:1020` (user row, G-5) and the harmless Deep system inserts (agent_loop :209/:1269) untouched — they default `'deep'` correctly and agent_loop is a G-5 hot file (only the mandatory filter edit was made there).

## Deviations from Plan

None — plan executed exactly as written. No deviation rules (1–4) were triggered; no auto-fixes, no auth gates, no architectural changes. The plan's enumerated insert-site map and filter design were followed verbatim.

## Issues Encountered

- **Pre-existing test debt + pending-migration failures in the regression guard (out of scope).** The plan's regression-guard run (`-k "dual_mode or 093 or runs"`) surfaced 9 failures. Classified by running the suspected-pre-existing set against the phase base `4bce9ded` (Task-1 files checked out at base, Task-2 stashed — on the main working tree, not a worktree):
  - **2 pending-migration (expected, resolved by Plan 03):** two `test_093_ask_user_workflow_run_live` tests fail with PostgREST `PGRST204: "Could not find the 'origin' column of 'messages'"` — my code writes `origin` but migration 076 is authored, not yet applied to the live DB. This is the documented interim state; both pass once Plan 03 applies 076.
  - **6 pre-existing (red at base, NOT caused by this plan):** 3 `test_db_runs.py` stale-arg-count assertions (incl. 2 on `insert_assistant_message` that were already red at 9 args from `reasoning_content`), plus `test_061` FK violation, `test_063_1` `KeyError:'model'`, `test_075_snapshot` body mismatch, `test_dual_mode_wiring` list-body mismatch — all live-DB data-state / stale-assertion debt unrelated to `origin`.
  - Both groups logged to `deferred-items.md` per the SCOPE BOUNDARY rule; not fixed here.

## Known Stubs

None — no stub patterns introduced. `origin` is a fully-wired enum: written at every harness site, read by the asymmetric filter, defaulted for Deep.

## User Setup Required

None for this plan. **Plan 03 (BLOCKING operator task)** applies migration 076 to the live DB (paste into the Supabase SQL editor / psycopg2 to local :54322 — NEVER `db push`) and regenerates `supabase/full-schema.sql` via `bash scripts/regenerate-full-schema.sh`. Until then the two `test_093` integration tests stay red (expected).

## Next Phase Readiness

- CTX-01 source + tests complete; migration authored. Plan 03 must apply migration 076 + add the live-DB integration test (NULL-origin count assertion, dual-mode replay isolation, Deep byte-identical row-set proof).
- `messages.origin` is the substrate Phase 130 (COLL-02 template_input resolver run-scope) and any future context-isolation work can build on.
- No blockers introduced. `api/threads.py` and `supabase/full-schema.sql` untouched (G-5 / Plan-03 ownership respected).

## Self-Check: PASSED

- Files verified present: `supabase/migrations/076_messages_origin.sql`, `backend/tests/test_120_origin_filter.py`, `.planning/phases/120-collision-fix-context-isolation/120-02-SUMMARY.md`.
- Commits verified in git log: `0b6241ab` (Task 1), `cf451131` (Task 2 RED), `ad959761` (Task 2 GREEN), `2c6c8c51` (SUMMARY).
- Protected files confirmed untouched across all commits: `backend/app/api/threads.py`, `supabase/full-schema.sql`.

---
*Phase: 120-collision-fix-context-isolation*
*Completed: 2026-06-22*
