---
phase: 084-workspace-filesystem-backend
plan: 05
subsystem: testing
tags: [google-genai, openrouter, supabase-py, bytea, schema-translation, defensive-coding, cross-provider]

requires:
  - phase: 084-02
    provides: workspace_service (DB layer used by REST + dispatcher)
  - phase: 084-03
    provides: tool_dispatcher workspace handlers + OpenAI tool schemas
  - phase: 084-04
    provides: REST /workspace endpoints with _decode_inline_content
provides:
  - Google schema sanitizer that translates type:[X,null] -> {type:X, nullable:true}
  - Dispatcher null-string + str-int normalization for weak OpenRouter models
  - REST hex-bytea decode branch for supabase-py PostgreSQL string format
  - 22 new unit tests pinning all three behaviors
affects: [v2.7 workspace surface, cross-provider tool integrations, future REST bytea endpoints]

tech-stack:
  added: []
  patterns:
    - Defensive normalization at dispatcher entry for weak-model JSON adherence
    - Wire-shape unification at REST decode (bytes / memoryview / hex-bytea / dict-Buffer / base64 / None)

key-files:
  created:
    - backend/tests/unit/test_workspace_api.py
  modified:
    - backend/app/services/google_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/api/workspace.py
    - backend/tests/unit/test_075_5_google_native.py
    - backend/tests/unit/test_tool_dispatcher.py
    - .planning/phases/084-workspace-filesystem-backend/084-HUMAN-UAT.md

key-decisions:
  - "OpenRouter fix shipped despite experimental status because it is native-safe + additive (no-op for properly-typed args) and gives the 6th provider a clean cycle without risk"
  - "_decode_inline_content gained defensive memoryview + dict-Buffer branches alongside the required hex-bytea fix, to absorb future supabase-py wire-shape drift"
  - "Google schema fix walks recursively into nested object properties so the same translation works for any future tool that adopts strict-mode nullable optionals"

patterns-established:
  - "Defensive normalization helper pattern: dispatcher entry coerces weak-model string forms (`null`/`None`/``) -> None and string ints -> int. Native-safe for the 5 properly-typed providers; only triggers on weak OpenRouter models that stringify JSON values."
  - "REST decoder wire-shape ladder: bytes / bytearray / memoryview -> direct UTF-8; dict {type:Buffer, data:[]} -> bytes(data); str startswith `\\x` -> bytes.fromhex; str fallback -> base64; None -> ''. Each branch logs on failure for future drift observability."

requirements-completed: [WS-02, WS-03, WS-04, WS-06, WS-07]

duration: 60min
completed: 2026-05-28
---

# Phase 084-05: Workspace cross-provider gap closure

**Three direct fixes that close the cross-provider UAT bandwidth blockers (Google ValidationError, OpenRouter list-empty, REST /content empty body) with 22 new unit tests pinning the behavior so future provider integrations can't silently regress.**

## Performance

- **Duration:** ~60 min (Tasks 1-3 executor + Task 4 Chrome MCP re-UAT)
- **Started:** 2026-05-28T13:48Z (gap-closure plan finalized)
- **Completed:** 2026-05-28T14:30Z (re-UAT all 7 tests green)
- **Tasks:** 4 (3 auto code-fix + 1 human-verify UAT)
- **Files modified:** 6 (3 source + 3 test files, 1 new test file)

## Accomplishments

- **Google ValidationError fixed:** `_sanitize_schema_for_google` now translates `type:[X,null]` -> `{type:X, nullable:true}` recursively. gemini-2.5-flash completes the workspace 6-prompt cycle.
- **OpenRouter weak-model dispatch fixed:** `_normalize_optional` / `_normalize_optional_int` helpers convert string `"null"`/`"None"`/`""` -> `None` and coerce string integers to `int` at dispatcher entry. llama-3.3-70b's `workspace_list` now returns rows it previously couldn't see.
- **REST /content empty-body fixed:** `_decode_inline_content` gained a `\x...` hex-bytea branch BEFORE the base64 fallback so supabase-py's PostgreSQL hex-escape string format decodes correctly. Same fix covers `/diff` endpoint.
- **22 new unit tests:** 7 for Google sanitizer, 5+2 for dispatcher normalizers, 10 for REST decoder wire-shapes — pinning all three behaviors so future drift fails CI.
- **Cross-provider regression-clean:** OpenAI, Anthropic, deepseek, moonshot all still pass post-fix (the dispatcher normalizer is a no-op for properly-typed args; Google sanitizer change keeps search_documents/query_tables/load_skill translating cleanly).

## Task Commits

1. **Task 1: Google schema sanitizer fix + 7 unit tests** — `9de4ed8` (fix)
2. **Task 2: Dispatcher null-string + str→int normalization + 7 unit tests** — `b78bfad` (fix)
3. **Task 3: REST hex-bytea decode + 10 unit tests** — `323e520` (fix)
4. **Task 4: Operator Chrome MCP re-UAT (human-verify gate)** — 084-HUMAN-UAT.md updated in-place by orchestrator (not its own commit; included in plan-completion commit)

## Files Created/Modified

- `backend/app/services/google_service.py` — added `_translate_nullable_type` helper; recursive call from `_sanitize_schema_for_google`; docstring updated to mention the translation
- `backend/app/services/tool_dispatcher.py` — added `_NULL_STRINGS`, `_normalize_optional`, `_normalize_optional_int` helpers; applied at entry to `_handle_workspace_list` (prefix), `_handle_workspace_read` (start_line, end_line), `_handle_workspace_diff` (from_version, to_version)
- `backend/app/api/workspace.py` — extended `_decode_inline_content` with memoryview / dict-Buffer / `\x...` hex-bytea / base64 fallback branches + warning log on decode failure
- `backend/tests/unit/test_075_5_google_native.py` — 7 new test cases pinning type-array nullable translation across scalar types, ordering, scalar passthrough, non-null array passthrough, nested object recursion, and a real-workspace-tools integration backstop
- `backend/tests/unit/test_tool_dispatcher.py` — 7 new test cases (5 helper-level + 2 handler-integration) covering null-string passthrough, real-value passthrough, str→int coercion, null-string-to-None for int, and uncoercible-to-None
- `backend/tests/unit/test_workspace_api.py` — new file, 10 test cases covering every observed bytea wire shape: bytes, bytearray, memoryview, hex-bytea str, uppercase hex, base64 fallback, dict-Buffer, None, malformed string, empty string
- `.planning/phases/084-workspace-filesystem-backend/084-HUMAN-UAT.md` — flipped Tests 3, 4, 9 from `issue` to `pass` with re-test stamps; updated Summary (passed: 9, issues: 0); closed all 3 Gaps with `closed_by` references to the three fix commits

## Decisions Made

- **Shipped OpenRouter fix despite experimental status** — because it is native-safe (no-op for properly-typed args from the 5 native providers) and additive defensive coding (~10 LOC). Per the project convention `[[feedback-openrouter-is-experimental]]`: experimental means not-prioritized, NOT ignore; fix when native-safe and low-risk.
- **Decoder gained defensive memoryview + dict-Buffer branches** in addition to the required `\x...` hex-bytea fix. Cost: ~5 extra LOC + 3 extra test cases. Benefit: absorbs future supabase-py version drift without re-triggering the empty-body blocker.
- **Google translation walks recursively** through nested object `properties`, not just the top-level `type` field. Cost: same complexity (the sanitizer already recursed). Benefit: any future tool that adopts strict-mode nullable optionals (e.g., a new search filter, a new skill metadata field) translates automatically with no further code changes.
- **Did NOT touch `_handle_workspace_write` or `_handle_workspace_delete`** — neither has nullable optional args, so the normalizer would be dead code.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1-3 followed the PLAN.md `<action>` blocks step-by-step. Task 4 followed the operator-driven Chrome MCP recipe in `<how-to-verify>` exactly.

## Issues Encountered

- **localStorage thread_id was stale:** The first attempt at running Test 9 used the user_id encoded in the streams localStorage key as the thread_id, which returned "Thread not found." Resolved by hitting `/threads?limit=5` to get the most recent thread's actual ID.
- **OpenRouter llama-3.3-70b write timing:** Took 44.5s on the write tool (vs 4-10s for native providers). Not a bug — model latency on OpenRouter's hosted llama is just slower.

## User Setup Required

None — no external service configuration changes. Operator only needed to restart the backend to pick up the 3 fix commits.

## Next Phase Readiness

- All Phase 084 UAT cross-provider blockers closed. Phase 084 is ready for VERIFICATION re-run + `phase.complete`.
- The 6th provider (OpenRouter) now has a clean cycle on llama-3.3-70b, expanding the cross-provider bandwidth for UAT-SC#10.
- 7 deferred UAT scenarios (multi-tool, parallel-thread, long-message, >256KB bucket, hostile path, 100-file limit) remain `skipped` in 084-HUMAN-UAT.md per the original scoping notes — they should be revisited at the next phase that touches workspace OR rolled forward at v2.7 milestone retrospective.

---
*Phase: 084-workspace-filesystem-backend*
*Completed: 2026-05-28*
