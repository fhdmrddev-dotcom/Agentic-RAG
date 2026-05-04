---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Deployment Strategy
status: ready_to_plan
stopped_at: Phase 063.1 complete — HUMAN-UAT scoreboard filled, project-level approved, Gap-006 (run hard-timeout) escalated to follow-on phase
last_updated: "2026-05-05T02:30:00.000Z"
last_activity: 2026-05-04
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 28
  completed_plans: 28
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 063.1 — frontend-stream-decoupling-gap-closure

## Current Position

Phase: 065
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-04
Next action: (1) Run `/gsd:verify-work` on Phase 063.1 to gate completion. (2) Plan the new follow-on phase **"Adaptive Run Timeouts & Lifecycle States"** (Gap-006 escalation) — addresses LLM agent stopping mid-iteration on complex tool-calling prompts; user-preferred fix paths are per-iteration timeout budget + split `cancelled` (user) vs `timed_out` (system) lifecycle states. (3) Carry-forward UAT items (SC#5 cross-tab Stop, SC#6 Resume live, SC#7 full 063 regression) belong to next manual UAT pass — non-blocking per Phase 063 precedent. Plan 05 deliverables: 3 e2e specs (`2ce760f`, `183b041`) + filled HUMAN-UAT.md + 063.1-05-SUMMARY.md. Live-bundle verification via Chrome MCP confirmed all four Wave 2/3/4 markers (`lastSeenOffsetRef`, `m.runId === run.run_id`, `abortStream` removal in ChatArea.tsx, `reconcileInFlightRef` + `temp-` MERGE filter) are served at `localhost:5173`. User's earlier observations of "delays / blank-on-fast-nav / late-stream rendering" predated Wave 3 + Wave 4 commits — they were testing pre-fix bundle in a stale tab.

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
| 062 | 01 | 12min | 2 | 4 (3 created, 1 modified) |
| Phase 062 P02 | 7min | 2 tasks | 5 files |
| 063.1 | 01 | 13min | 3 | 3 (1 created, 2 modified) |
| 063.1 | 02 | 12min | 2 (3 commits — RED + 2 GREEN) | 3 (modified) |
| Phase 063.1 P03 | 18min | 2 tasks | 2 files |
| Phase 063.1 P04 | 4min | 1 tasks | 1 files |
| Phase 063.1 P05 | ~70min total (across 2 sessions: spec authoring + close-out) | 3 tasks (2 e2e batches + UAT scoreboard fill) | 5 files (3 e2e specs + HUMAN-UAT.md + SUMMARY) |

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
- Phase 062 plan 01: anti-false-RED guards on ownership tests — assert detail='Thread not found' AND threads SELECT was actually called; without these the tests pass even before the route is registered
- Phase 062 plan 02: replay_tail_consumer mirrors event_consumer verbatim with last_id=since (D-062-07); zero-line modification of off-limits regions in threads.py confirmed via git diff
- Phase 062 plan 02: top-level 'from redis.exceptions import RedisError' import to avoid the variable-shadowing trap on the route's 'redis' parameter (any 'redis.exceptions.X' inside the handler would AttributeError on the Redis instance); pattern documented in module docstring + inline comment + invariant noted for future maintainers
- Phase 062 plan 02 deviation (Rule 3): added per-file '_reset_redis_singleton' autouse fixture to 3 new stream test files — singleton _redis is event-loop-bound, pytest-asyncio creates per-test loops, so subsequent tests hit a closed loop on the cached singleton (Pitfall 6 mirror); per-file scope avoids surprising 058/059/061 tests
- Phase 063.1 plan 02: onCursor fires AFTER the type-specific dispatch and is SKIPPED on terminal branches (stream_end/error/cancelled return early) — cursor advancement is meaningless once the run has ended; lastEventId resets to undefined after each fire so cursor-less legacy frames don't inherit stale ids
- Phase 063.1 plan 02: reused messagesRef.current (already declared at useMessages.ts:316-319 for stopStreaming WR-03 fix) for the runId-match dedup; same pattern, same justification, no second ref needed
- Phase 063.1 plan 02 (Rule 3 deferred-item): vitest cannot run locally on this machine due to missing rolldown native binding cascade (npm optional-dep bug — @rolldown/binding-win32-x64-msvc + @jridgewell/sourcemap-codec not installed); tests committed and gated via TypeScript compilation per the plan's `<verify>` block; runtime test execution deferred to CI / freshly `npm install`-ed environment
- Phase 063.1 plan 03: inline guardedSetMessages in sendMessage rather than lifting WR-05 to a hook-level helper — reconcile's guard captures activeThreadIdRef !== threadId-snapshot while sendMessage's guard captures streamingThreadIdRef !== activeThreadIdRef; semantically different signatures, so a unified helper would just add indirection
- Phase 063.1 plan 03: dropped abortStream from ChatArea destructure since the only call site is the one being removed (D-063.1-07); abortStream stays exported from useMessages and consumed by genuine-timeout paths (loadMessages's loadAbortRef)
- Phase 063.1 plan 03: D-063.1-10 audit confirmed single useMessages consumer (ChatArea.tsx:39) and stable mount lifetime (no key=thread.id on ChatArea); hook unmount effect only fires on logout/route change — documented in a comment block above the unmount effect
- Phase 063.1 plan 03 (Rule 1 verify-command bug): plan's grep -rn 'useMessages()' src | wc -l == 1 check is too broad — matches the function declaration too; semantically the audit (single consumer in ChatArea) passes via grep -v 'export function useMessages' precision filter
- Phase 063.1 plan 03 (Rule 3 deferred-item carried forward from Plan 02): vitest runtime unavailable on this machine (npm optional-dep cascade); TDD ceremony simplified to TypeScript-gated single commit with behavior cases documented in commit body — matches plan's actual <verify> gate (tsc + grep)
- Phase 063.1 plan 04: reconcileInFlightRef as bool not Map (D-063.1-11) — only one viewing thread at a time, single in-flight bit suffices; mirrors resumeInFlightRef shape verbatim. Sync set BEFORE Promise.all dispatch ensures the second concurrent caller (also synchronous to same tick before its own await) reads true and bails at top guard. Outer try/finally wraps entire body; every early-return path flows through finally to release the lock (T-063.1-13 mitigation).
- Phase 063.1 plan 04: loadMessages MERGE three-clause filter (D-063.1-12) — m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId). Each clause necessary: temp- prefix scopes to placeholders only, runId presence rejects pre-run-backed legacy temps, !dbRunIds.has guards against dup-bubble when DB has caught up (reconcile's runId-dedup at D-063.1-04 will route SSE deltas to the DB row). Spread order [...data, ...liveTempPlaceholders] — DB rows first (chronological from server), placeholders appended (most recent run_id by definition). React keys stable on id field, no collision risk.
- Phase 063.1 plan 04: reconcile for-loop body kept BYTE-IDENTICAL inside new outer try/finally — only structural wrapping changed. Inner indentation preserved at original level (TypeScript whitespace-insensitive); re-indenting ~150 lines would balloon diff and risk subtle drift in dedup/cursor/onTerminal blocks. Plan acceptance criterion explicitly required byte-identical for-loop content vs Plan 02 result.
- Phase 063.1 plan 04 (Rule 3 deferred-item carried forward from Plans 02/03): vitest runtime unavailable on this machine (npm optional-dep cascade — @rolldown/binding-win32-x64-msvc + @jridgewell/sourcemap-codec missing); TDD ceremony simplified to TypeScript-gated single commit with the six behavior cases (Tests 1-6) documented in commit body — matches plan's actual <verify> gate (tsc + grep). Plan 05 E2E specs (063.1-concurrent-reconcile.spec.ts, 063.1-refresh-no-duplicate-bubble.spec.ts) provide cross-stream regression coverage.
- Phase 063.1 plan 05: HUMAN-UAT.md closed `status: partial` with project-level `approved` — splits the two concerns. Project-level approval reflects that Wave 2/3/4 fixes are live and load-bearing (verified via Chrome MCP — all four markers `lastSeenOffsetRef` / `m.runId === run.run_id` / no `abortStream` in ChatArea / `reconcileInFlightRef` + `temp-` filter served at localhost:5173); UAT-file `partial` reflects three SCs that need an end-to-end manual run depending on Phase 064's `ENABLE_TEST_FIXTURES=1` harness (SC#5 cross-tab Stop, SC#6 Resume live, SC#7 full 063 regression). Mirrors Phase 063's precedent where UAT shipped `partial` with similar carry-forwards.
- Phase 063.1 plan 05: Gap-006 (LLM agent stops mid-iteration on complex tool-calling prompts) escalated to a new follow-on phase **"Adaptive Run Timeouts & Lifecycle States"** rather than patched in 063.1. Root cause: `RUN_HARD_TIMEOUT_SECONDS = 120s` (`backend/app/config.py:251`) wraps the entire agent loop via `asyncio.timeout` (`backend/app/api/threads.py:842`); when the timeout fires it cancels the producer task and the cancellation propagates through every nested await including the LangSmith-wrapped LLM stream iterator (surfaces in trace as `GeneratorExit`). Live `runs` table evidence (12-hour window, 24 runs): 5 of 11 cancellations clustered at 120–152s with `error: null`. Out-of-scope rationale: 063.1's scope is frontend gap closure; the timeout pipeline is untouched by 063.1. User-preferred fix paths: (path 2) per-iteration timeout budget that resets on each tool-call boundary + (path 3) split `cancelled` (user) vs `timed_out` (system) lifecycle states with `runs.error = "timed_out after Ns"` populated. Phase number TBD by orchestrator.

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

Last session: 2026-05-05T02:30:00.000Z
Stopped at: Phase 063.1 closed — 5/5 plans complete, project-level **approved**, HUMAN-UAT scoreboard filled with live-bundle verification evidence (Chrome MCP), Gap-006 (run hard-timeout) escalated to follow-on phase. Final commit: `docs(063.1-05): close plan with HUMAN-UAT approval + Gap-006 escalation`.
Next: (1) `/gsd:verify-work` on Phase 063.1. (2) `/gsd:plan-phase` (or `/gsd:discuss-phase`) for the new follow-on phase **"Adaptive Run Timeouts & Lifecycle States"** to address Gap-006.

**Completed Phase:** 063.1 (frontend-stream-decoupling-gap-closure) — 5/5 plans — closed 2026-05-04 (UAT `partial`, project-level `approved`)

**Carry-forward (non-blocking):**
- SC#5 cross-tab Stop end-to-end (Phase 064 fixture harness)
- SC#6 Resume button live test under `ENABLE_TEST_FIXTURES=1` (Phase 064)
- SC#7 full Phase 063 SC#1–#6 manual regression (next manual UAT pass)

**New phase queued (Gap-006 escalation):** "Adaptive Run Timeouts & Lifecycle States" — phase number TBD by orchestrator (likely 064 or later; distinct from Phase 064 Validation Harness which is test infrastructure, not a fix). Full details in `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md → ## Gaps → Gap-006`.
