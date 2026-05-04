---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Deployment Strategy
status: executing
stopped_at: Completed 063.1-03-PLAN.md (thread-switch SSE persistence — drop abortStream + guardedSetMessages in sendMessage)
last_updated: "2026-05-04T21:44:49.368Z"
last_activity: 2026-05-04
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 28
  completed_plans: 26
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 063.1 — frontend-stream-decoupling-gap-closure

## Current Position

Phase: 063.1 (frontend-stream-decoupling-gap-closure) — EXECUTING
Plan: 4 of 5
Status: Ready to execute
Last activity: 2026-05-04
Next action: Execute 063.1-03-PLAN.md (Wave 3 — Thread-switch SSE persistence: delete `abortStream()` from `ChatArea.tsx:95` thread-change useEffect; lift `guardedSetMessages` into sendMessage gating on `streamingThreadIdRef.current === activeThreadIdRef.current`; audit useMessages hook unmount semantics — D-063.1-06..08, D-063.1-10). 063.1-02 shipped: lastSeenOffsetRef Map declared adjacent to subscriptionsRef; api.ts getMessages snake→camel mapper for run_id/run_status; subscribeToRun parser captures Redis Stream `id:` lines and fires optional onCursor callback after each successful data: dispatch (terminal branches return early); reconcile rewritten with runId-match dedup (Gap-001), narrowed `subscriptionsRef.has()` short-circuit (Gap-003 partial), and cached cursor in subscribeToRun (Gap-004). ChatArea.tsx untouched (Plan 03's scope). 3 atomic commits (b011db8 RED test, e4a00fb api.ts GREEN, 454125d useMessages.ts) + SUMMARY/STATE/ROADMAP commit. tsc --build --noEmit clean for the 3 touched files. Vitest can't run locally (npm optional-dep cascade — @rolldown/binding-win32-x64-msvc + @jridgewell/sourcemap-codec missing); tests committed and gated via TypeScript per the plan's `<verify>` block.

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

Last session: 2026-05-04T21:44:49.359Z
Stopped at: Completed 063.1-03-PLAN.md (thread-switch SSE persistence — drop abortStream + guardedSetMessages in sendMessage)
Next: Execute 063.1-03-PLAN.md (Wave 3 — Thread-switch SSE persistence: delete `abortStream()` from ChatArea.tsx:95 thread-change useEffect; lift guardedSetMessages into sendMessage gating on streamingThreadIdRef === activeThreadIdRef; audit useMessages hook unmount semantics — D-063.1-06..08, D-063.1-10).

**Completed Phase:** 058 (Backend SSE Concurrency Fix) — 3/3 plans — verified 2026-05-01

**Planned Phase:** 063.1 (frontend-stream-decoupling-gap-closure) — 5 plans — 2026-05-04T17:38:32.503Z (2/5 plans complete; 3/5 next)
