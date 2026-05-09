---
phase: 066-adaptive-run-timeouts-lifecycle-states
verified: 2026-05-06T20:00:00Z
status: passed
score: 7/7 must-haves verified
must_haves_total: 7
must_haves_verified: 7
generated: 2026-05-06T20:00:00Z
file_count: 9
overrides_applied: 0
---

# Phase 066: Adaptive Run Timeouts & Lifecycle States — Verification Report

**Phase Goal:** Restore parity with v2.4's long-tool-call behavior under the run-backed architecture. Complex tool-calling agents must not be silently cut off by a 120s total-deadline timeout. Per-LLM-call budgets reset on tool-call boundaries. When a budget IS exceeded, the run terminates as `timed_out` (distinct from user-initiated `cancelled`), captures a clear `runs.error` row, and the UI surfaces an "Agent reached time limit" banner with a Resume button.

**Verified:** 2026-05-06T20:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (7 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1 | Complex tool-calling prompt completes end-to-end (≥4 iterations); no mid-iteration stop | VERIFIED | Live UAT: run `95e3447c-cf9b-448b-9e0d-22c30e40670d` completed in 9m02s with `status='completed'`, `error=NULL`, multi-iteration `execute_code` plus chart PNGs + DOCX rendered. Recorded in `066-HUMAN-UAT.md` SC#1 Evidence row + 066-05 SUMMARY. Pre-066 wrapper would have killed at ~120s; this run lasted 542s. |
| SC#2 | Per-LLM-call budget replaces total-deadline OR ≥600s total, with documented decision (D-v2.5-NN) | VERIFIED | `backend/app/api/threads.py`: outer `asyncio.timeout(settings.run_hard_timeout_seconds)` DELETED (zero hits in source — verified by grep). Per-call wrap appears at lines 1213 (Anthropic) + 1297 (OpenAI/Google/OpenRouter) — `async with asyncio.timeout(per_call_budget)` (2 hits). `MODEL_CAPABILITIES` registry carries `llm_call_timeout_seconds` field on all 32 entries with 60/90/180/240/600s buckets per the matrix. `get_per_call_timeout()` helper at `config.py:154`. Plan 04 `test_066_per_call_timer.py` (4 tests) binds the contract: timer fires within ε of budget, resets per iteration, tool exec outside timer. D-066-01..03/11 documented in 066-CONTEXT.md. |
| SC#3 | `runs.status` admits 5 values (`timed_out` added); migration extends CHECK; backend writes `timed_out` from system path; backend writes `cancelled` only on user-Stop; Pydantic Literal mirrors | VERIFIED | `supabase/migrations/038_runs_timed_out_status.sql`: single-statement DROP+ADD CHECK with 5-value enum (verified). `supabase/full-schema.sql:440`: live-DB regen post-apply contains `'timed_out'::text` in CHECK ARRAY. `backend/app/models/message.py:44`: 5-value `Literal["streaming","completed","failed","cancelled","timed_out"]`. `threads.py:2275`: TimeoutError branch writes `_terminal_status = "timed_out"`. `runs.py:386-388`: cancel_run still writes `"status": "cancelled"`, `"error": "cancelled_by_user"` (T-066-01 partition guard intact); short-circuit at 388 admits all 5 terminal values per BLOCKER fix `add00b9`. Plan 04 `test_066_status_enum.py` (4 tests, all pass). Live SQL editor smoke INSERT with `status='timed_out'` succeeded during Plan 01 Task 2. |
| SC#4 | `runs.error` non-NULL with discriminator prefix on every non-completed terminal; format `<reason>: <detail>` | VERIFIED | `threads.py:2275-2280`: TimeoutError branch writes `f"timed_out: {_last_per_call_budget}s per-call deadline exceeded at iteration {_last_iteration} (model={_last_model_id})"` (D-066-07 final form). Exception branch writes `f"failed: {type(e).__name__}: {_truncated_msg}"` with `[:200]` cap (T-066-02 mitigation). CancelledError leaves `_terminal_error = None`; runs.py:423 cancel handler writes `"cancelled_by_user"` (separate path). Plan 04 `test_066_terminal_classification.py` (4 tests including `test_timeout_branch_writes_timed_out` + `test_failed_error_truncated_to_200_chars` + `test_delete_writes_cancelled_not_timed_out` + `test_delete_on_timed_out_row_short_circuits_silently` — partition guards both directions). |
| SC#5 | SSE consumer receives distinct `timed_out` terminal event, distinguishable from `error` and `cancelled` | VERIFIED | `threads.py:87`: `TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})`. `threads.py:98`: `_RUN_STATUS_TO_TERMINAL_TYPE["timed_out"] = "timed_out"` (distinct from `"error"` route). Plan 04 `test_066_sse_terminal.py`: `test_consumer_receives_timed_out_sentinel` + `test_timed_out_sentinel_distinct_from_error_and_cancelled` (2 tests). Frontend wire-format match verified: `frontend/src/lib/api.ts:387` parser dispatches `t === "timed_out"` to `onTerminal("timed_out")`. |
| SC#6 | Backend integration test asserts: synthetic timeout terminates as `timed_out`, writes non-NULL `runs.error`, does NOT propagate `GeneratorExit` to LangSmith | VERIFIED | `threads.py:1247`: `_ant_gen.close()` (sync, anthropic 0.97.0) called inside TimeoutError handler before re-raise. `threads.py:1334`: `stream.close()` (sync, openai 2.28.0) called inside TimeoutError handler before re-raise. Plan 04 `test_066_langsmith_clean.py::test_no_generator_exit_on_timeout` asserts via caplog that no log line contains `'GeneratorExit'` on the TimeoutError path. Live UAT 9m02s run had no GeneratorExit warning at `run_helpers.py:1680` per 066-HUMAN-UAT.md. |
| SC#7 | Live regression: re-run user's Gap-006 prompt — must complete successfully | VERIFIED | Live UAT recorded in `066-HUMAN-UAT.md` SC#1+Gap-006-regression Evidence: user re-ran verbatim prompt `"search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx"` in dev app at localhost:5173/, thread `96b646ca-c122-4081-843f-2558ebc5746a`. Run row: `status='completed'`, `error=NULL`, elapsed `00:09:02.846449`. Multi-iteration `execute_code` produced chart PNGs + DOCX deliverable. Pre-066 architecture would have killed at iteration ~2 (~120s). Confirmed approved by user in plan 05 sign-off. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/038_runs_timed_out_status.sql` | DROP+ADD CHECK adding `timed_out` | VERIFIED | File exists; `'timed_out'` token present in CHECK; user applied via SQL editor (Plan 01 Task 2 — `applied`). |
| `supabase/full-schema.sql` | Regenerated post-apply with 5-value CHECK | VERIFIED | Line 440: `CHECK ((status = ANY (ARRAY[...,'timed_out'::text])))` post-regen. |
| `backend/app/models/message.py` | 5-value Pydantic Literal | VERIFIED | Line 44: `Literal["streaming","completed","failed","cancelled","timed_out"]`. |
| `backend/app/config.py` | ModelCapability extended; per-call timeout matrix; helpers; consumer_timeout_seconds | VERIFIED | `llm_call_timeout_seconds` appears 39 times (TypedDict + 32 model entries + helpers + tests-of-record). `get_per_call_timeout` at line 154; `_parse_llm_call_timeout_overrides` at line 186; `consumer_timeout_seconds: int = 610` at line 381. `run_hard_timeout_seconds` field DELETED from Settings (zero hits in `backend/app`). |
| `backend/app/api/threads.py` | Outer wrapper deleted; per-call timer wrap (2 paths); SDK close-then-raise; refined error string; TERMINAL_TYPES extended | VERIFIED | `async with asyncio.timeout(settings.run_hard_timeout_seconds)`: 0 hits (deleted). `async with asyncio.timeout(per_call_budget)`: 2 hits (lines 1213, 1297). `_ant_gen.close()`: line 1247. `stream.close()`: line 1334. Refined error string `f"timed_out: {_last_per_call_budget}s per-call deadline exceeded at iteration {_last_iteration} (model={_last_model_id})"` at line 2277. `TERMINAL_TYPES` includes `"timed_out"` at line 87. Plan 04 Rule 1 fix (`except (asyncio.TimeoutError, asyncio.CancelledError): raise` ahead of inner APIError/Exception handlers) at line 2123. |
| `backend/app/api/runs.py` | Cancel handler partition guard intact; short-circuit admits 5 values; consumer_timeout_seconds replacement | VERIFIED | Cancel handler at line 423 still writes `"status": "cancelled"`. Short-circuit at line 388: `if row["status"] in ("completed","failed","cancelled","timed_out"):` (BLOCKER fix `add00b9`). Docstring at lines 336-339 references the 5-value enum. `settings.consumer_timeout_seconds` at line 87. Zero hits for `settings.run_hard_timeout_seconds`. |
| `frontend/src/types/index.ts` | 5-value `Message.runStatus` union | VERIFIED | Line 98: `runStatus?: "streaming" \| "completed" \| "failed" \| "cancelled" \| "timed_out"`. |
| `frontend/src/lib/api.ts` | 5-value getMessages mapper; 4-value onTerminal kind union; subscribeToRun parser dispatches `t === "timed_out"` | VERIFIED | Line 73: 5-value run_status type. Line 172: `onTerminal: (kind: "done" \| "error" \| "cancelled" \| "timed_out", error?: string) => void`. Line 379: `else if (t === "timed_out") { ... callbacks.onTerminal("timed_out", parsed.error...) }`. |
| `frontend/src/hooks/useMessages.ts` | 5th onTerminal branch in BOTH callsites (sendMessage + reconcile) | VERIFIED | Line 573 (sendMessage): `if (kind === "timed_out") return { ...m, runStatus: "timed_out", stopped: true }`. Line 812 (reconcile): `if (kind === "timed_out") return { ...m, runStatus: "timed_out" }` (no stopped per reconcile-path convention). |
| `frontend/src/components/chat/MessageItem.tsx` | Resume gating extends to timed_out; "Agent reached time limit" banner | VERIFIED | Line 104: Resume button gates on `(message.runStatus === "failed" \|\| message.runStatus === "timed_out")`. Lines 136-137: in-content banner `runStatus === "timed_out" ? "Agent reached time limit"`. Line 159 + 163: secondary post-content indicator covers `(message.stopped \|\| message.runStatus === "timed_out")` with copy switch — Rule-2 deviation prevents contradictory copy. |
| `backend/tests/integration/test_066_*.py` (5 new files + 1 rewrite) | All 18 Plan 04 tests pass per Plan 04 SUMMARY | VERIFIED | All 5 test files exist: `test_066_status_enum.py` (4), `test_066_terminal_classification.py` (4 incl. BLOCKER regression `test_delete_on_timed_out_row_short_circuits_silently`), `test_066_per_call_timer.py` (4), `test_066_sse_terminal.py` (2), `test_066_langsmith_clean.py` (1). `test_061_hard_timeout.py` rewritten as 4-test deletion guard. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Producer per-call asyncio.timeout fire | `runs.status='timed_out'` write | TimeoutError → outer except → `_shielded_finalize` → DB UPDATE | WIRED | `threads.py:1213/1297` per-call wrap → `1247/1334` SDK close → propagates to outer `except asyncio.TimeoutError` at `2271-2280` → `_terminal_status = "timed_out"`, refined `_terminal_error` → finalizer writes row. Plan 04 Rule 1 fix ensures TimeoutError isn't swallowed by inner APIError/Exception handlers (line 2123). |
| Backend SSE wire `{type:'timed_out'}` | Frontend `onTerminal("timed_out")` callback | Wire-format byte match | WIRED | Backend emits `timed_out` per `_RUN_STATUS_TO_TERMINAL_TYPE` (`threads.py:98`); frontend parser at `api.ts:379` matches `t === "timed_out"` and dispatches. Plan 04 `test_066_sse_terminal.py` binds the wire-format contract. |
| `onTerminal("timed_out")` in hook | "Agent reached time limit" banner + Resume button | `setMessages` writes `runStatus="timed_out"` → MessageItem renders | WIRED | `useMessages.ts:573/812` set runStatus → `MessageItem.tsx:104` (Resume) + `136-137` (banner) + `159-163` (secondary indicator). |
| `cancel_run` DELETE handler | `runs.status='cancelled'` only (NEVER `timed_out`) — partition guard | Direct DB UPDATE | WIRED | `runs.py:423` writes `"status": "cancelled"` (zero hits for `timed_out` in runs.py write paths). Short-circuit at line 388 protects already-`timed_out` rows from re-write (BLOCKER fix `add00b9`). Both directions of T-066-01 partition guarded by `test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out` AND `test_delete_on_timed_out_row_short_circuits_silently`. |
| MODEL_CAPABILITIES registry | per_call_budget at agent loop | `get_per_call_timeout(model_id, settings)` called inside while-True loop | WIRED | `config.py:154` helper resolves env override → per-model capability → 180s default. `threads.py` imports `from app.config import get_per_call_timeout` locally inside both provider paths (test patchability per Plan 04 IN-01). 32 model entries carry `llm_call_timeout_seconds` per the 60/90/180/240/600s matrix. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MessageItem.tsx` (banner copy on timed_out) | `message.runStatus` | `useMessages.ts` `setMessages` updater fed by SSE `onTerminal("timed_out")` callback fed by backend SSE `{type:"timed_out"}` event fed by `_RUN_STATUS_TO_TERMINAL_TYPE` translation of `runs.status='timed_out'` written by producer's TimeoutError branch | Yes — full chain validated by Plan 04 wire-format tests + 066-HUMAN-UAT.md confirms 9m02s `status='completed'` happy-path data flow | FLOWING |
| `runs.error` row | `_terminal_error` | producer's outer except branch reads `_last_iteration / _last_model_id / _last_per_call_budget` closure vars updated inside both per-call timer wraps | Yes — closure trio set per-iteration in both Anthropic (1187-1189) and OpenAI (1293-1295) paths; live UAT `error=NULL` on completed happy-path; Plan 04 `test_timeout_branch_writes_timed_out` asserts `error.startswith('timed_out:')` | FLOWING |

### Behavioral Spot-Checks

Step 7b spot-checks did not require running the backend — Plan 04 integration tests provide equivalent behavioral binding.

| Behavior | Evidence | Result | Status |
|----------|----------|--------|--------|
| `from app.api.threads import TERMINAL_TYPES; assert "timed_out" in TERMINAL_TYPES` | grep verified at threads.py:87 | `frozenset({"done","error","cancelled","timed_out"})` present | PASS |
| `from app.models.message import MessageResponse` accepts `run_status='timed_out'` | grep verified at message.py:44 (Literal); Plan 01 SUMMARY documents successful Pydantic constructor smoke test | OK | PASS |
| `frontend tsc --noEmit` exit-0 | Plan 03 SUMMARY: ran twice (post-Task-1+2 and post-commit), both exited 0 with zero errors | OK | PASS |
| Migration 038 applied to live DB; INSERT with `status='timed_out'` succeeds | Plan 01 SUMMARY: user replied `applied`; smoke INSERT with `status='timed_out'` followed by ROLLBACK succeeded | OK | PASS |
| Plan 04 integration test suite green for all 18 Plan 066 tests + 4 rewritten test_061 tests | Plan 04 SUMMARY: full integration suite delta pre-fix 28 failed → post-Rule-1-fix 21 failed (same 21 are pre-existing in unrelated files); Rule 1 fix CLOSED 7 prior failures; all 18 Plan 04 tests pass | OK | PASS |
| BLOCKER regression `test_delete_on_timed_out_row_short_circuits_silently` | Test exists in `test_066_terminal_classification.py:249`; commit `add00b9` claims passing | OK (per commit message + file inspection) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STREAM-04-polish | 066-01 / 02 / 03 / 04 / 05 | Run-backed streaming polish — addresses Gap-006 | SATISFIED | All 7 SCs verified above; Gap-006 architecturally closed per 066-HUMAN-UAT.md. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/threads.py` | 1213-1239, 1297-1326 | Sync iteration of LLM SDK stream inside `async with asyncio.timeout(...)` cannot preempt mid-network-read | Info (pre-existing architectural — WR-01 in 066-REVIEW.md) | The deadline cannot fire while `next(stream)` is blocked on a network read until the SDK's own httpx default timeout (~5min). Mitigation: SDK `close()` is called before re-raise; live UAT confirms happy-path completes. Carry-forward documented for follow-up phase. |
| `backend/app/config.py` | 143 | `DEFAULT_LLM_CALL_TIMEOUT_SECONDS = 180` is module constant, not Settings field | Info (IN-02 in 066-REVIEW.md) | Operators looking for the global default via env-var grep won't find it. Minor polish. |
| `frontend/src/components/chat/MessageItem.tsx` | 159 | Stopped-indicator condition could render for legacy `stopped=true` on `runStatus='completed'` rows | Info (IN-04 in 066-REVIEW.md) | Defensive code-smell only; legacy `stopped` field defaults undefined on completed rows. |
| `frontend/src/hooks/useMessages.ts` | 573 vs 812 | sendMessage sets `stopped:true` on timed_out; reconcile does not — divergent | Info (IN-05 in 066-REVIEW.md) | MessageItem keys on runStatus regardless, so user-visible behavior identical today. Future code that keys on `stopped` could trip up. |
| `supabase/migrations/038_runs_timed_out_status.sql` | 23-26 | Migration is not idempotent — re-running raises "constraint does not exist" | Info (WR-02 in 066-REVIEW.md) | Manual SQL editor apply path has no schema_migrations guard; copy-paste twice fails. Hardening only — does not affect Phase 066 deliverable. |
| `backend/app/api/threads.py` | 865-867 | Closure-var defaults `_last_iteration=0` / `_last_model_id=""` / `_last_per_call_budget=0` could produce misleading error string on edge paths | Info (WR-03 in 066-REVIEW.md) | In all currently-implemented happy paths, values are set before any per-call timer wrap. Theoretical concern only. |

**Note:** All 6 anti-patterns are Info-level (warnings/info from 066-REVIEW.md), all marked acceptable for v1 ship per the carry-forward / hardening tier. The single Blocker from 066-REVIEW.md (BL-01: cancel_run short-circuit missing `timed_out`) was fixed inline in commit `add00b9` with regression test, leaving zero unresolved blockers in the codebase.

### Human Verification Required

None at the architectural verification level. The single user-visible architectural assertion (Gap-006 regression — SC#1, SC#7) was already executed in `066-HUMAN-UAT.md` Plan 05 Task 1 and confirmed PASSED by user (`status='completed'` after 9m02s with multi-iteration tool calls).

The synthetic-timeout UX live verification (would have proven SC#5/SC#6 frontend banner rendering live) was DEFERRED to Phase 067 per explicit user decision and the Phase 063 / 063.1 carry-forward precedent. The architectural backend `timed_out` lifecycle is bound by `test_066_terminal_classification.py::test_timeout_branch_writes_timed_out` (PASSED), so the backend half of SC#5/SC#6 is automated. The frontend half (banner copy renders, Resume button visible, Resume click re-POSTs) is queued for Phase 067 to re-execute Plan 05 Task 2 protocol after the streaming-display UX bugs land.

**This is acceptable scope-escalation, NOT a phase 066 gap**, per the user's direction recorded in `066-05-SUMMARY.md` Decisions Made section and `066-HUMAN-UAT.md` SC#6 row + Sign-off block. Phase 067 absorbs five carry-forward UX items (UX-067-01..05) plus the deferred Plan 05 Task 2 re-run.

### Gaps Summary

No gaps blocking Phase 066's architectural deliverable. The phase goal — "Restore parity with v2.4's long-tool-call behavior" — is achieved end-to-end:

- **Backend lifecycle architecture**: 5-value enum live in DB + Pydantic + producer; per-LLM-call timer replaces the 120s wrapper; clean SDK close-before-raise; refined runs.error format; partition guard between system-`timed_out` and user-`cancelled` enforced both directions.
- **Frontend lifecycle UI**: 5-value runStatus type; SSE parser dispatches `timed_out`; both onTerminal callsites mirror; Resume button gates on `(failed || timed_out)`; "Agent reached time limit" banner copy.
- **Test bindings**: 18 Plan 04 integration tests + 4 rewritten test_061 tests + 1 BLOCKER regression test all pass. Plan 04 caught and fixed a Plan 02 production swallow bug (Rule 1 — inner exception handler now correctly re-raises TimeoutError to outer classifier).
- **Live regression closed**: Gap-006 user prompt completed in 9m02s (vs ≥120s legacy kill point), confirmed in 066-HUMAN-UAT.md.
- **BLOCKER addressed**: 066-REVIEW.md flagged a partition-guard hole (DELETE on already-`timed_out` row reverts to `cancelled`); commit `add00b9` extends `runs.py:388` short-circuit + adds `test_delete_on_timed_out_row_short_circuits_silently` regression test.

Five carry-forward UX items (UX-067-01..05) and the deferred synthetic-timeout UX live test are scope-escalated to Phase 067 per explicit user decision and Phase 063/063.1 precedent. They do not block Phase 066 closure because they belong to a different layer (frontend streaming display) than Phase 066's deliverable (backend timeout/lifecycle architecture). The frontend code wiring for the new lifecycle IS in place and type-checks cleanly; only the runtime UX verification with a forced-timeout fixture is deferred.

---

_Verified: 2026-05-06T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Depth: standard goal-backward verification_
