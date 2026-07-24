---
phase: 175-cross-provider-streaming-fidelity
plan: 02
subsystem: api
tags: [deepseek, streaming, sanitizer, sse, provider-gateway, cross-provider, dsml]

# Dependency graph
requires:
  - phase: 092.5-provider-gateway-extraction
    provides: "_ClosableEventStream._normalize adapter + _strip_deepseek_tool_markup (the shipped DSML floor this plan hardens)"
  - phase: 162.5-threads-producer-extraction
    provides: "the post-drain consumer seam in agent_loop where the Option-B hook lands"
provides:
  - "stream-end DSML flush (XPROV-02a) — a held non-leaking _dsml_pending fragment is emitted as a final delta so a deepseek turn ending mid-opener-prefix never silently swallows content"
  - "self.dsml_leaked flag on _ClosableEventStream (deepseek-gated, latches True when the strip begins leaking)"
  - "Option-B post-drain hook in agent_loop emitting the EXISTING 'error' SSE event via DSML_LEAK_ERROR_MESSAGE when a leak is detected (XPROV-02b)"
  - "DSML_LEAK_ERROR_MESSAGE — single-sourced fixed honest-incomplete copy (no raw-model interpolation)"
affects: [176-chat-render-correctness, agent_loop, openai_compat, deepseek-streaming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stream-end flush of held sanitizer state — drain the pending buffer as a final event, gated so only the provider that populates it is affected (D-14 default-inert)"
    - "Option-B honest-incomplete signal — expose a mutable flag on the stream instance, read it post-drain, reuse the EXISTING error SSE event (never invent a new event type; never edit the per-chunk emit path)"
    - "Fixed-copy error single-sourced as a module constant so the emit site + its test share one string (no drift, no raw-model interpolation)"

key-files:
  created:
    - backend/tests/unit/test_dsml_leak_signal.py
  modified:
    - backend/app/services/provider_gateway/openai_compat.py
    - backend/app/services/agent_loop.py
    - backend/tests/unit/test_openai_compat_dsml_strip.py

key-decisions:
  - "XPROV-02a: the flush lands AFTER the chunk loop and BEFORE the usage yield, guarded `if _dsml_pending and not _dsml_leaking` — leaking-at-end flushes nothing (SC#2 floor holds)"
  - "XPROV-02b: Option B (post-drain flag read + existing error event) chosen over Option A (a new carrier on the finish dict) so the hot per-chunk emit dict + finish dict stay byte-identical (D-14)"
  - "The honest copy is a module constant DSML_LEAK_ERROR_MESSAGE (fixed string, no interpolation of the model's attacker-controllable leaked markup — T-175-02-02)"
  - "getattr(stream, 'dsml_leaked', False) default keeps anthropic/google streams (plain generators without the attr) byte-identical"

patterns-established:
  - "Drive the full _normalize generator over minimal SimpleNamespace-shaped fake chunks to prove stream-end behavior (not just the pure _feed filter)"
  - "TDD RED->GREEN per task: failing test committed first (test:), then the minimal implementation (feat:)"

requirements-completed: [XPROV-02]

# Metrics
duration: 15min
completed: 2026-07-22
---

# Phase 175 Plan 02: DeepSeek DSML Sanitizer Hardening + Honest Leak Signal Summary

**Hardened the shipped DeepSeek DSML sanitizer with a deepseek-gated stream-end flush (no trailing content-loss) and turned a detected tool-markup leak into one honest `error` SSE event via an Option-B post-drain hook — additive, default-inert, D-14 byte-identical for every non-deepseek/clean-deepseek path.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-22T16:55:00Z
- **Completed:** 2026-07-22T17:05:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments
- **XPROV-02a stream-end flush:** `_normalize` now flushes a held non-leaking `_dsml_pending` fragment as a final `delta` after the chunk loop — a deepseek turn ending mid-opener-prefix (e.g. final chunk `"<｜"`) no longer silently swallows that content. The flush is guarded (`_dsml_pending and not _dsml_leaking`), so a turn still leaking at stream end flushes nothing and the SC#2 no-dirty-render floor holds across chunk boundaries and long turns.
- **XPROV-02b honest-incomplete signal:** a detected DSML leak (DeepSeek writing a tool call as visible text, so the tool never runs) now ends the turn honestly. `_ClosableEventStream` latches `self.dsml_leaked=True` the moment the strip begins leaking; the agent_loop post-drain hook reads it and emits exactly ONE existing `error` SSE event with the fixed copy `DSML_LEAK_ERROR_MESSAGE` ("The model tried to call a tool but wrote it as text, so it didn't run. Please retry.").
- **D-14 default-inert preserved:** the flush is reachable only on the deepseek path (only the deepseek-gated strip populates `_dsml_pending`); the leak flag stays `False` for clean/non-deepseek streams; the consumer's `getattr(..., False)` default keeps anthropic/google plain-generator streams byte-identical. No new SSE event type, no per-chunk emit-dict edit, no finish-dict edit.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing stream-end flush test** - `3d8b9935` (test)
2. **Task 1 (GREEN): stream-end flush in `_normalize`** - `2757811e` (feat)
3. **Task 2 (RED): failing DSML leak-signal test** - `a6946fec` (test)
4. **Task 2 (GREEN): leak flag + post-drain error hook** - `0ce91bf2` (feat)

**Plan metadata:** final `docs(175-02)` commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified
- `backend/app/services/provider_gateway/openai_compat.py` - `_ClosableEventStream.__init__` inits `self.dsml_leaked=False`; the deepseek strip branch latches it True when leaking; `_normalize` flushes a held non-leaking `_dsml_pending` fragment as a final `delta` before the usage yield.
- `backend/app/services/agent_loop.py` - module-level fixed-copy `DSML_LEAK_ERROR_MESSAGE`; post-drain hook after the openai-compat drain emitting the existing `error` event when `getattr(stream, "dsml_leaked", False)`.
- `backend/tests/unit/test_openai_compat_dsml_strip.py` - extended with 4 stream-end-flush cases driving the full `_normalize` generator (flush trailing prefix; no-flush-when-leaking; long-turn floor; non-deepseek byte-identical).
- `backend/tests/unit/test_dsml_leak_signal.py` - NEW: 7 cases proving the flag flips only on a leaking deepseek stream and the post-drain guard emits exactly one fixed-copy `error` (zero otherwise, incl. attr-absent).

## Decisions Made
- **Option B over Option A** for the leak signal (post-drain flag read + existing `error` event, not a new carrier on the finish dict) — keeps the hot per-chunk emit path + finish dict byte-identical (D-14). This matches the RESEARCH/PATTERNS recommendation.
- **Fixed-copy error as a module constant** (`DSML_LEAK_ERROR_MESSAGE`) single-sourced between the emit site and its test — the copy never interpolates the model's raw (attacker-controllable) leaked markup (T-175-02-02 info-disclosure control).
- **Flush placed after the loop, before the usage yield**, guarded on non-leaking pending — the minimal reachable-only-on-deepseek edit.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the specified TDD RED→GREEN flow; the flush placement, the Option-B hook site, and the fixed-copy safety all match the plan's `<action>` and threat register.

## Issues Encountered
None during planned work. The full unit suite carries **63 pre-existing failures** (async source-drift rot in `test_retrieval_service` / `test_sandbox_service` / `test_sql_service` / `test_streaming_reliability` — e.g. `query_documents` is now a coroutine the old tests call synchronously; tracked under SEED-056 / `075.4-TEST-TRIAGE.md`). Differential proof: the phase-start baseline shows the **identical 63 failures** — **zero net-new failures** from this plan. Per the SCOPE BOUNDARY rule these are out-of-scope and were NOT touched.

## Deferred Issues
- Pre-existing unit-suite rot (63 failures, unchanged from baseline) — already tracked (SEED-056, `075.4-TEST-TRIAGE.md`); not caused by this plan, not in scope.
- Assumption A1 (alternate DeepSeek opener variants beyond `<｜｜DSML｜｜`) remains a live-repro coverage NOTE, not a blocker — the single opener + flush ship; broaden only if the long-turn DeepSeek UAT surfaces a different delimiter.
- SC#10 long-message axis (DeepSeek ~26+ tool-call turn → no dirty render + honest signal) stays manual per `175-VALIDATION.md` (the leak is timing/length-dependent).

## Test Evidence
- `test_openai_compat_dsml_strip.py`: **12 passed** (4 new stream-end-flush + 8 pre-existing pure-filter cases stay green).
- `test_dsml_leak_signal.py`: **7 passed** (flag flips + post-drain single-emit + fixed-copy safety).
- Provider-gateway cluster (`test_provider_gateway_seam.py` + DSML + `test_chunk_handler_provider_aware.py`): **38 passed** — the ~30 adapter-patching integration tests are green (no adapter regression).
- Full unit suite: **1353 passed / 63 pre-existing-rot failed** vs baseline **1278 passed / 63 failed** — zero net-new failures.

## User Setup Required
None - no external service configuration required. Backend-only, additive, no migration, no new package, no env var.

## Next Phase Readiness
- XPROV-02 delivered; the DSML floor (SC#2) is hardened and a leaked-tool-as-text turn now ends honestly. Plan 03 (routing gate) + Plan 04 (title injection/guard application) are unaffected — this plan touched only the deepseek sanitizer path + the post-drain consumer seam.
- Red line held: Deep Mode / the shared `_normalize` per-chunk path / the shared `_on_chunk` consumer stay byte-identical for every non-deepseek provider and every clean deepseek turn.

## Self-Check: PASSED
- Files: all 4 present (`openai_compat.py`, `agent_loop.py`, `test_openai_compat_dsml_strip.py`, `test_dsml_leak_signal.py`).
- Commits: `3d8b9935`, `2757811e`, `a6946fec`, `0ce91bf2` all found in git history.

---
*Phase: 175-cross-provider-streaming-fidelity*
*Completed: 2026-07-22*
