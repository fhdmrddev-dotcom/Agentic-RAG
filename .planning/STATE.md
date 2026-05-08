---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Deployment Strategy
status: Phase 067.3 OPEN — strict UAT gate not met (R-3 RED, 067.2 Row 6 RED mirror); follow-on phase 067.4 needed for suggestion-emit fix + carry-forward 067.2 OpenRouter timeout rows
stopped_at: Phase 067.3 Plan 05 — UAT executed with gaps; escalating to Phase 067.4
last_updated: "2026-05-09T00:00:00.000Z"
last_activity: 2026-05-09 -- Phase 067.3 UAT executed; 9/12 GREEN, R-3 RED → escalating to Phase 067.4
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 54
  completed_plans: 49
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 067.3 — streaming-render-and-storage-fixes-round-2

## Current Position

Phase: 067.3 (streaming-render-and-storage-fixes-round-2) — **EXECUTED-WITH-GAPS** (Plan 05 closing UAT shipped; strict 12/12 GREEN gate NOT met; escalating to Phase 067.4)
Plan: 5 of 5 (Plan 05 closed; gap-escalation branch)
Status: Phase 067.3 OPEN — UAT 9 GREEN / 2 RED (R-3 family) / 2 deferred. Phase 067.2 also stays OPEN alongside (cross-phase D-067.3-WAVE-03 rule).
Last activity: 2026-05-09 -- Phase 067.3 UAT executed; 9/12 GREEN, R-3 RED → escalating to Phase 067.4

Blockers (escalated to Phase 067.4):

  - **R-3** Row R-3 + Row 067.2-6 (cross-phase mirror) — Suggestion pills not emitted to SSE for Fahed-Mrad search-only prompts. Two separate run_ids confirmed: `36b509e2-b281-4de2-af79-70d9df73334d` (initial) + `00dcf270-3773-44e2-8181-6ee36169dc03` (retest after `max_tokens` 200→800 hypothesis bump). SSE replay (`/runs/{id}/stream?since=0`) `uniqueKinds` shows: `[title, iteration_start, tool_preparing, tool_start, tool_end, planning, delta, sources, citations, confidence, done]` — NO `suggestions` event, NO `fallback_model` event. The emit at `backend/app/api/threads.py:2477` is never reached, OR is reached with `questions=[]`. Confidence indicator renders correctly across both runs ("Low confidence" / "Medium confidence"); only the suggestion-pills rendering is broken. **Hypothesis disconfirmed:** `max_tokens` budget bump 200→800 in `backend/app/services/suggestion_service.py:75/92` did NOT fix it. Retest run `00dcf270-3773-…` ALSO produced no `suggestions` event in SSE. Root cause is elsewhere. Phase 067.4 must investigate `backend/app/services/suggestion_service.py` + threads.py 2487-2526 emit-path. Likely candidate causes for 067.4: (1) `client.chat.completions.create(...)` raising a non-`NotFoundError` exception that the broad `except Exception:` at threads.py:2509 swallows (Plan 04 instrumentation `logger.warning("suggestion generation failed", exc_info=True)` should yield a stack trace in uvicorn stdout — capture next); (2) `gpt-5.4-mini` reasoning-token consumption with even 800-token budget; consider 2000 or model swap; (3) JSON output parser miscount (response.choices[0].message.content empty due to function-call-style response wrapping that's not flowing to the structured-output path).
  - **NR-deferred-row-067.2-11** Row 067.2-11 — OpenRouter Kimi 2.5 live timeout regression. Carry-forward from Phase 067.2; **`OPENROUTER_API_KEY` IS present** in `backend/.env`, but synthetic-timeout protocol was not exercised during 067.3 UAT (out of 067.3 plan-set scope per D-067.3-WAVE-03 multi-provider availability rule). Phase 067.4 must run synthetic-timeout protocol: set `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10`, restart uvicorn, submit a long-form prompt with model=kimi-k2.5 → confirm `runs.status='timed_out'` + `runs.error='timed_out: 10s per-call deadline exceeded at iteration N (model=moonshotai/kimi-k2.5)'`. Clean cancellation format (NOT `GeneratorExit`).
  - **NR-deferred-row-067.2-12** Row 067.2-12 — OpenRouter MiniMax 2.7 live timeout regression. Same carry-forward situation as 067.2-11. Phase 067.4 must run synthetic-timeout protocol with model=`minimax/minimax-m2.7`.

Phase 067.3 GREEN summary (closed in this phase, do not re-litigate):

  - **R-1** (Plan 03 — per-thread message store via `messagesByThread` Map): cross-thread switch mid-stream now preserves the streamed-into thread's render. Verified via 2 concurrent multi-step streaming threads (run_ids `8cb9c8cd-…` + `7742ed37-…`); both rendered full content, no cross-talk, no token loss. Mirrors 067.2 Row 3 GREEN.
  - **R-2** (Plan 02 — sandbox download via JS blob fetch+download helper in `frontend/src/lib/api.ts:downloadSandboxOutput`): pgvector docx download verified end-to-end (run_id `906fcf04-…`); 302 redirect to Supabase CDN → 200, zero 401s. Mirrors 067.2 Row 4 GREEN.
  - **R-2-IDOR** (Plan 02 — D-067.3-R2-05 cross-user IDOR): existence-leak prevention at `backend/app/api/sandbox_outputs.py:48-67` returns 404 to foreign user_id paths. Verified via technical-equivalent (same JWT + foreign user_id). Frontend helper translates 404 → "File not found." toast.
  - **R-2 long-TTL re-sign** (Plan 02 architecture): same pgvector docx URL re-signed twice ~12 min apart yielded distinct `iat` values (1778274062 / 1778274782); each click hits FastAPI re-sign endpoint and produces fresh ~60s signed URL. Mirrors 067.2 Row 5 GREEN (architecture-equivalent — slow-path 90-min wait unnecessary).
  - **N-01** (Plan 01 — model→provider router): `claude-sonnet-4-6` request streamed end-to-end via Anthropic SDK (run_id `7682f8e2-…`, status `completed`). 4/4 unit tests in `backend/tests/test_provider_router.py` pass on merged tree.
  - **No-regression check (067.3-NR):** 4 streaming threads (Bread, Physicists, pgvector, Photosynthesis) all completed cleanly; auto-title generation working on all 4; no regression detected.

Deferred (other carry-forwards, NOT Phase 067.4 scope):

  - **N-02** (UX/cost concern) Multi-step pipeline self-QA = 8 of 14 tool_calls on opus pptx run. Cap via SYSTEM_PROMPT or MAX_SELF_QA_ITERATIONS in a future UX phase. NOT in Phase 067.4 scope.

Phase 067.2 GREEN summary (working, do not regress):

  - Plan 01 streaming-render race fix (useLayoutEffect alignment) — Rows 1, 2 confirmed; new-thread + F5 mid-stream paths.
  - Plan 02 auto-title hoist — Rows 7, 8 confirmed (Stop + synthetic timeout titles).
  - Plan 03 sandbox-outputs endpoint LOGIC works (path-segment fence, sandbox_files lookup, 60s TTL re-sign, 302 redirect) — but the auth integration is broken for `<a href>` clicks (R-2).
  - Plan 04 audit predicted no-op for confidence; confidence ✓, suggestions ✗ (R-3).
  - Plan 05 multi-provider smoke ✓ for all 4 models; Plan 01 Track A helper symmetry confirmed via Row 9.
  - NR-1, NR-2 — Phase 067.1 / 066 contracts still hold.

Next action: Discuss + plan Phase 067.4 (`/gsd:discuss-phase 067.4` then `/gsd:plan-phase 067.4`). Scope: (a) **PRIMARY (gate-blocking)** R-3 suggestion-emit fix — investigate `backend/app/services/suggestion_service.py` and the emit path at `backend/app/api/threads.py:2466-2526`. Capture the Plan 04 instrumentation log (`logger.warning("suggestion generation failed", exc_info=True)`) from uvicorn stdout to disambiguate exception-swallow vs `questions=[]` vs reasoning-token-starvation. (b) **SECONDARY (carry-forward)** Run synthetic-timeout protocol for kimi-k2.5 (Row 067.2-11) and minimax-m2.7 (Row 067.2-12) on the OpenRouter branch. Closing UAT must mirror back into BOTH 067.2-HUMAN-UAT.md AND 067.3-HUMAN-UAT.md to close all three open phases (067.2, 067.3, 067.4) together.

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
- Phase 067 added 2026-05-07: Frontend Streaming-UX Fix — close the 5-issue carry-forward dossier (UX-067-01..05) surfaced by Phase 066's live UAT (empty first-paint, "Saving response…" thrash, refresh-required first-paint, redis log noise on tab cycle, tool-call iteration boundary surfacing). Re-runs Phase 066 Plan 05 Task 2 protocol to close out SC#6 live verification deferred from 066.

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

Last session: 2026-05-09
Stopped at: Phase 067.3 Plan 05 closed — UAT executed with gaps; escalating to Phase 067.4
Next: `/gsd:discuss-phase 067.4` → `/gsd:plan-phase 067.4` for the follow-on phase covering (a) R-3 suggestion-emit fix [primary, gate-blocking] and (b) carry-forward 067.2-11 + 067.2-12 OpenRouter timeout regression checks [secondary]. After 067.4 ships, BOTH Phase 067.2 AND Phase 067.3 close alongside Phase 067.4 via the cross-phase D-067.3-WAVE-03 closure rule (now extended to 067.4).

**Phases OPEN (cross-phase blocked):**

- **Phase 067.2** (streaming-render-and-storage-fixes) — OPEN; strict 12/12 gate not met. Rows 3/4/5 resolved by 067.3 in practice but cannot tick GREEN until Row 6 closes via 067.4. Rows 11/12 deferred to 067.4. Audit trail in `067.2-HUMAN-UAT.md` preserved + new `## Phase 067.3 verdict — 9/12 GREEN (gate not met)` section appended.
- **Phase 067.3** (streaming-render-and-storage-fixes-round-2) — OPEN; 5/5 plans landed but Plan 05 closing UAT showed 9 GREEN / 2 RED / 2 deferred. R-3 root cause unidentified during UAT (max_tokens hypothesis disconfirmed live). Full evidence in `067.3-HUMAN-UAT.md` + `067.3-05-SUMMARY.md`.

**Phase 067.4 scope (next):**

- Primary (gate-blocking): R-3 suggestion-emit fix — `backend/app/services/suggestion_service.py` + `backend/app/api/threads.py:2466-2526` emit path investigation + fix.
- Secondary (carry-forward): OpenRouter kimi-k2.5 + minimax-m2.7 synthetic-timeout regression checks.
- Closing UAT: mirror verdicts back into 067.2-HUMAN-UAT.md, 067.3-HUMAN-UAT.md, AND 067.4-HUMAN-UAT.md — close all three phases together when strict gate met.

**Completed Phase:** 063.1 (frontend-stream-decoupling-gap-closure) — 5/5 plans — closed 2026-05-04 (UAT `partial`, project-level `approved`)

**Carry-forward (non-blocking, pre-067.4):**

- SC#5 cross-tab Stop end-to-end (Phase 064 fixture harness)
- SC#6 Resume button live test under `ENABLE_TEST_FIXTURES=1` (Phase 064)
- SC#7 full Phase 063 SC#1–#6 manual regression (next manual UAT pass)

**Earlier queued phase (Gap-006 escalation):** "Adaptive Run Timeouts & Lifecycle States" — phase number TBD by orchestrator (likely 064 or later; distinct from Phase 064 Validation Harness). Full details in `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md → ## Gaps → Gap-006`. NOT 067.4 scope.

**Planned Phase:** 067.3 (Streaming Render & Storage Fixes — Round 2) — 5 plans — 2026-05-08T19:52:03.820Z (executed 2026-05-09, OPEN with gaps)
