---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Deployment Strategy
status: executing
stopped_at: Phase 061 plan 05 (binding tests + 061-VERIFICATION.md) complete
last_updated: "2026-05-02T17:30:51Z"
last_activity: 2026-05-02 -- Phase 061 plan 05 complete (binding tests + 061-VERIFICATION.md)
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 14
  completed_plans: 12
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase --phase — 061

## Current Position

Phase: 061 (Run-Backed Streaming Backend) — EXECUTING (5/5 plans complete; verification pending)
Plan: 5 of 5 COMPLETE — Binding tests + 061-VERIFICATION.md (commits e555ae6, 57b2cef, 9ab4cef, 9d1e8f5)
Status: Wave 3 complete; phase 061 ready for /gsd:verify-work
Last activity: 2026-05-02 17:30 UTC — Plan 05 (binding tests + 061-VERIFICATION.md) complete
Next action: Run /gsd:verify-work on phase 061 — executes the 11 binding pytest commands documented in 061-VERIFICATION.md (TBD-01..11) plus the 060 e2e Playwright spec. After verification, phase 061 closes and phase 062 (Replay & Tail API) unblocks. Plan 05 deliverables verified by static checks (file presence + AST parse + grep counts on every plan acceptance criterion); runtime test execution is deferred to the verifier (sandbox-blocked from executor per prior wave experience). Locked decisions: D-v2.5-08 (Redis Streams), D-v2.5-10 (STREAM-02b absorbed), D-v2.5-11 (single-feature-branch + `runs` Postgres table). Plan 05 lands the Phase 061 merge gate: TBD-01..11 binding tests (8 test files), the D-061-16 contract inversion (test_059_disconnect.py rewrite carrying explicit D-v2.5-08 + Phase 061 references in both file docstring and commit message), and 061-VERIFICATION.md mirroring 058/059 format with binding-test results table + manual two-tab DevTools checklist.

## Recent Completed Phases

### Phase 56.1: Agent Feedback Gaps (Complete 2026-04-29)

- D-01 (OpenAI _announced_tools): tool_preparing emits exactly once per tool index
- D-03 (ElapsedTimer): setInterval(250ms) with cleanup; clean-out on unmount
- D-05 (Structured mode): two-loop pattern populates buffer before emitting tool_preparing

### Phase 56: Agent Real-Time Feedback (Complete 2026-04-29)

- tool_preparing SSE event eliminates silence windows during tool argument streaming
- Elapsed time counter for running tools
- Initial planning event guaranteed to fire

### Phase 57: SSE Realtime Reconnect Fix (Deferred — see 057-DEFERRAL.md)

- Two attempts failed (Phase 057 v2.4, v2.5-dev branch reverted)
- Root cause: backend FastAPI single-worker + sync supabase calls block event loop
- Plus three frontend race conditions documented for v2.5 to address

## Performance Metrics

**Velocity:**

- Total plans completed: ~80 (across v1.0–v2.4)
- Previous milestones: v1.0 (8 phases), v2.0 (9), v2.1 (8), v2.2 (7), v2.3 (11), v2.4 (14 phases, 2 deferred)
- Average duration: ~1 day/phase

**Recent Trend:**

- Last phase fully shipped: Phase 56.1 (2026-04-29)
- Trend: Stable

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 061 | 01 | 4min | 3 | 4 |
| 061 | 02 | 1min | 2 | 2 |
| 061 | 03 | 16min | 3 (2 commits — Tasks 2+3 atomic) | 1 |
| 061 | 04 | 25min | 2 | 2 |
| 061 | 05 | 10min | 4 | 12 (9 created, 3 modified) |

## Accumulated Context

### Roadmap Evolution

- v2.5 milestone scoped 2026-05-01 to fix Phase 057 deferral via 5 phases (058–062)
- Research synthesized at .planning/research/058-sse-concurrency-research.md before milestone start
- ROADMAP.md authored 2026-05-01: 5 phases, 5/5 v1 requirements mapped, dependencies form valid DAG (058→059→060→061; 062 parallel-able with 058)
- Phase 063 added 2026-05-02: Skills Test Infrastructure Repair — close TEST-DEBT discovered during 059-02 verification (13+ broken patches in test_threads_skills.py + 3 broken export tests). Standalone, parallel-able with 060-062. Prep for upcoming Skill Studio milestone (see SEED-002).

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting v2.5 work:

- **D-v2.5-01**: Backend SSE concurrency fix uses `run_in_threadpool` wrapping (tactical) over `asyncio.to_thread` or full async client. Reason: purpose-built for FastAPI/Starlette, respects contextvars, smallest diff. Long-term migration to asyncpg deferred.
- **D-v2.5-02**: Multi-worker uvicorn (`--workers N`) is NOT the answer for the concurrency bug. Masks the issue, breaks in-memory state, hides from observability. Single worker maintained until blocking calls are fixed.
- **D-v2.5-03**: Supabase Realtime treated as best-effort hint, not source of truth. Reconcile via fetch on every (re)connect. Confirmed by Supabase discussion #21093.
- **D-v2.5-04**: SSE architecture refactor uses `asyncio.Queue` + background task + `sse-starlette` (not Celery, not BackgroundTasks). Decouples handler lifetime from agent loop lifetime.
- **D-v2.5-05**: Frontend reconnect uses `visibilitychange` + `pageshow` + single reconcile fetch + Resume button (not auto-polling loop). Don't auto-retry LLM calls — costs money, may duplicate.
- **D-v2.5-06**: Race-condition fix uses `AbortController` cancellation, not request-id refs alone. Confirmed canonical by React docs and Max Rozen post.
- **D-v2.5-07**: Validation harness (Phase 062) lands before Phase 061 reconnect work — addresses the v2.5-dev failure mode where iterating on a complex hook without browser feedback loop hid real bugs.
- Phase 059 plan 03: rename inner sandbox queue to sandbox_queue (Rule 1 fix to plan 02 — UnboundLocalError shadowing bug)
- Phase 059 plan 03: D-059-06 merge gate green; D-059-07 058 regression test still passes; D-059-08 059-VERIFICATION.md published mirroring 058 format
- Phase 059 plan 03: httpx ASGITransport buffers entire SSE response — real mid-stream disconnect cannot be tested via this transport, manual verification (059-VERIFICATION.md) is the runbook for that
- Phase 061 plan 03: Tasks 2+3 committed atomically — wrapping the agent_runner body in `async with asyncio.timeout(...)` requires re-indenting ~1100 lines, which inevitably touches the inner finally Task 3 was scoped to rewrite. Splitting into two commits would have left the file syntactically valid but semantically broken (timeout context with old asyncio.Queue sentinel). Single atomic commit (22a814c) with comprehensive message documents both task scopes.
- Phase 061 plan 03: `_persist_assistant_message` modified to return `Optional[str]` (the inserted message_id) — used by the shielded finalizer to populate `runs.message_id` in the UPDATE. Idempotent re-call returns the cached id from a closure-captured `_persisted_msg_id` slot.
- Phase 061 plan 03: token-counter accounting deferred (RESEARCH Q1 NULL fallback adopted) — runs UPDATE leaves input_tokens/output_tokens NULL; SDK usage capture scoped out of 061. Schema columns exist; future plan can populate without breaking 061's contract.
- Phase 061 plan 03: D-061-03 contract inversion confirmed in code — event_consumer's finally is `pass` (no task.cancel, no await task). Producer survives consumer disconnect; bounded only by asyncio.timeout(120s) per D-061-01.
- Phase 061 plan 05: 8 test files landed for VALIDATION.md TBD-01..11 — 3 unit (test_061_emit_helper, test_061_consumer, test_health), 4 integration (test_061_producer_survives_disconnect with inline cross-tab D-061-15 assertion, test_061_ttl, test_061_runs_table with DDL-inspection RLS variant, test_061_hard_timeout), 1 rewritten integration (test_059_disconnect for D-061-16 contract inversion). Plus shared _run_helpers.py and _build_mock_supabase 'runs' branch. Static gates green; runtime execution deferred to /gsd:verify-work (sandbox blocks venv/Scripts/python).
- Phase 061 plan 05: D-061-16 rewrite of test_059_disconnect.py committed atomically with explicit D-v2.5-08 + Phase 061 references in both file docstring and commit message body — protects future reviewers from misreading the inversion as a regression. Original `test_agent_task_cancels_on_disconnect` removed; new `test_agent_task_SURVIVES_on_disconnect` asserts XLEN growth post-disconnect.
- Phase 061 plan 05: VALIDATION.md frontmatter (`nyquist_compliant: true`, `wave_0_complete: true`) NOT toggled by this commit — those flags require runtime green which the verifier owns. The 11 binding pytest commands are documented in 061-VERIFICATION.md as a single copy-paste block.

### Pending Todos

| Source | Task | Status |
|--------|------|--------|
| 057 | E/F symptoms still unreliable — third attempt scoped to v2.5 | ⏸ Carried forward |
| Phase 056.1 P01 | 127s | 4 tasks | 1 files |
| Phase 056.1 P03 | 10 | 3 tasks | 1 files |
| Phase 059 P03 | 20min | 2 tasks | 3 files |

### Blockers/Concerns

- UAT verification gaps from v2.3 (phases 038–042) still require live browser testing
- Metadata normalization only covers document_type/language
- 15 backend test failures remain from side-phase 002 (test-suite-remediation)
- Phase 46 human UAT (3 items): CASCADE cleanup, dialog rendering, non-contiguous version promotion

### Known Issues

- **KI-001:** In-flight LLM calls and tool executions continue after SSE disconnect because Python async generators can only receive `GeneratorExit` at `yield` points. The current LLM call or tool execution runs to completion before the generator stops. Iteration stops immediately after, preventing new rounds. See `.planning/KNOWN-ISSUES.md`. *(v2.5 Phase 059 may indirectly address this via the asyncio.Queue refactor — handler exits on disconnect, agent task gets cancelled cleanly.)*

## Deferred Items

Items acknowledged at v2.4 milestone close (2026-04-30) — 19 items:

| Category | Item | Status |
|----------|------|--------|
| uat | Phase 45: 45-HUMAN-UAT.md — 5 pending scenarios | partial |
| uat | Phase 46: 46-HUMAN-UAT.md — 3 pending scenarios | partial |
| uat | Phase 48: 48-HUMAN-UAT.md — 6 pending scenarios | partial |
| verification | Phase 45: 45-VERIFICATION.md — human_needed | human_needed |
| verification | Phase 46: 46-VERIFICATION.md — human_needed | human_needed |
| verification | Phase 48: 48-VERIFICATION.md — human_needed | human_needed |
| quick_task | 12 quick tasks marked missing | missing |
| streaming | Phase 057 SSE Realtime Reconnect Fix | deferred → v2.5 |
| streaming | Phase 055 Streaming Reliability (4/5 plans) | deferred → v2.5 |

## Session Continuity

Last session: 2026-05-02T17:30:51Z
Stopped at: Phase 061 plan 05 (binding tests + 061-VERIFICATION.md) complete — phase 061 ready for /gsd:verify-work
Next: Run /gsd:verify-work on phase 061 to execute the 11 binding pytest commands documented in 061-VERIFICATION.md plus the 060 Playwright e2e spec; on green, phase 061 closes and phase 062 (Replay & Tail API) unblocks

**Completed Phase:** 058 (Backend SSE Concurrency Fix) — 3/3 plans — verified 2026-05-01

**Planned Phase:** 061 (Run-Backed Streaming (Backend)) — 5 plans — 5/5 complete (Plans 01, 02, 03, 04, 05); verification pending
