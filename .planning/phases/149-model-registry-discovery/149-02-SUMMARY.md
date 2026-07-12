---
phase: 149-model-registry-discovery
plan: 02
subsystem: api
tags: [httpx, asyncio, model-discovery, provider-fanout, model-registry, sc3-propose-only]

# Dependency graph
requires:
  - phase: 096
    provides: curate_models.py — the PROVIDER_ENDPOINTS table, per-shape id extractors, google/anthropic pagination, and sort_newest_first that this service lifts and wraps
provides:
  - "model_discovery_service.discover_all(keyed) — async httpx fan-out over the hardcoded 8-provider allowlist returning honest per-provider outcomes (no_key / http-* / ok + caps)"
  - "model_discovery_service.compute_diff(current, discovered) — new/changed/vanished partition with propose-only capability fill (SC#3); pure/injected-current, JSON-serializable"
  - "model_discovery_service.keyed_from_settings() — env-key resolver helper for the Plan 05 operator endpoint"
affects: [149-05, model-registry-discovery, admin, plan-05-discover-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "async provider fan-out via asyncio.gather(..., return_exceptions=True) over a hardcoded code-constant allowlist (SSRF-safe: no caller URL ever reaches the client)"
    - "propose-only capability fill: an un-returned capability is a distinct UNKNOWN sentinel, never a guessed value and never an auto-enable (SC#3)"
    - "pure service with injected `current` registry — no DB read — so the diff is unit-testable and Wave-1-independent"

key-files:
  created:
    - backend/app/services/model_discovery_service.py
    - backend/tests/test_149_discovery.py
  modified: []

key-decisions:
  - "discover_all takes a `keyed: dict[str, str|None]` map (caller resolves keys) so the fan-out reads no settings and accepts no URL — kept pure/testable + SSRF-safe; added keyed_from_settings() as the Plan 05 env resolver"
  - "capabilities_returned is True only for google + openrouter — the only two providers whose /models returns capability metadata (RESEARCH matrix)"
  - "UNKNOWN is the string sentinel 'unknown' — distinct from a bool so the UI can render the amber 'you set it' input; native_tools on Google stays UNKNOWN (no clean tools boolean)"

patterns-established:
  - "Pattern 1: honest per-provider outcome dicts — no_key skipped (not failed), non-200 excluded with verbatim http-{status} (not failed), one provider's exception never aborts the others"
  - "Pattern 2: propose-only fill asymmetry falls out of the per-model caps map — OpenRouter fills all three, Google only token limits, IDs-only providers fill nothing"

requirements-completed: [MODEL-02]

# Metrics
duration: 5min
completed: 2026-07-12
---

# Phase 149 Plan 02: Model Registry & Discovery — Discovery Service Summary

**Async httpx fan-out over the hardcoded 8-provider `/models` allowlist with honest per-provider outcomes, plus a pure compute_diff that partitions new/changed/vanished and fills capabilities propose-only (OpenRouter native_tools + limits, Google limits only, everyone else "unknown — you set it") — the SC#3 hero, fully unit-tested with all 8 providers mocked.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-12T06:34:57Z
- **Completed:** 2026-07-12T06:39:42Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `discover_all(keyed)` fans out concurrently to every provider in the verbatim-lifted `PROVIDER_ENDPOINTS` allowlist and returns one list of honest per-provider outcome dicts — `no_key` (skipped, not failed), `http-{status}` (excluded, not failed — the 058/060 lesson), `error-{Exc}` (isolated), or `ok` with newest-first ids + a caps map.
- Lifted the `curate_models.py` extractors (`_extract_openai_compat`, `_extract_minimax`, `sort_newest_first`), the per-auth header/param construction, and the google `nextPageToken` + anthropic `has_more`/`last_id` pagination loops — converted from blocking `requests` to `httpx.AsyncClient` (the `rerank_service.py` idiom, `timeout=12.0` per request). Casing preserved verbatim (Pitfall 6).
- `compute_diff(current, discovered)` partitions new/changed/vanished against an **injected** `current` registry (no DB read). Every `new` model lands `enabled=false`; capabilities fill ONLY where the provider returned them; a failed/no_key provider manufactures zero false-vanished entries.
- SC#3 is provable in `test_propose_only`: a Google new model's `native_tools` is the `unknown` sentinel (never a bool), an OpenAI new model has every capability `unknown`, an OpenRouter new model has `native_tools` filled from `supported_parameters`, and NO new model is auto-enabled.
- Zero new external packages (`httpx` already in requirements.txt).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Async fan-out over the hardcoded provider allowlist** — `b3825693` (test, RED) → `2780fbe9` (feat, GREEN)
2. **Task 2: Diff computation + propose-only capability fill (SC#3)** — `86f4af36` (test, RED) → `050331ff` (feat, GREEN)

**Plan metadata:** (this commit) `docs(149-02): complete model-registry-discovery service plan`

## Files Created/Modified
- `backend/app/services/model_discovery_service.py` (465 lines) — the async provider-discovery fan-out (`discover_all`) + diff computation (`compute_diff`) + `keyed_from_settings()` env resolver, over the verbatim `PROVIDER_ENDPOINTS` allowlist with the lifted extractors/pagination/sort.
- `backend/tests/test_149_discovery.py` — `test_provider_outcomes` (all 8 providers mocked at `httpx.AsyncClient.get`: no_key / http-429 excluded / exception isolation / google+anthropic pagination / verbatim casing / capabilities_returned), `test_discovery` (new/changed/vanished + vanished-excludes-failed), `test_propose_only` (the SC#3 asymmetry).

## Decisions Made
- **`discover_all` reads no settings and accepts no URL.** It takes a `keyed: dict[str, str|None]` map; the caller (Plan 05) resolves keys. This keeps the fan-out pure/testable and enforces the SSRF defense (T-149-03) structurally — iteration is over `PROVIDER_ENDPOINTS` only, never over caller-supplied keys. A `keyed_from_settings()` helper was added (Rule 2 — self-contained) so the Plan 05 endpoint has a ready env resolver.
- **`capabilities_returned` True only for `google` + `openrouter`** per the RESEARCH capability matrix — the two providers whose `/models` returns any capability metadata.
- **`UNKNOWN` is the string `"unknown"`**, distinct from a bool, so the UI renders the amber "you set it" input. The propose-only asymmetry falls out naturally from the per-model caps map (OpenRouter carries all three fields, Google only the token limits, IDs-only providers carry none), so `_build_new_entry` needs no per-provider branching.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The pre-existing `RequestsDependencyWarning` (urllib3/chardet version mismatch) surfaces during pytest collection but is unrelated to this plan (it originates from the `requests` package, which this service does not use) and does not affect the tests.

## Known Stubs
None. The service is fully functional: `keyed_from_settings()` reads real env-configured keys, `discover_all` performs real concurrent HTTP (mocked only in tests), and `compute_diff` is complete pure logic. The operator HTTP endpoint that calls this service is intentionally deferred to Plan 05 (this service ships independently in Wave 1 per the plan objective).

## User Setup Required
None - no external service configuration required. (The discovery endpoint and its provider-key env vars are wired in Plan 05.)

## Next Phase Readiness
- The discovery service is self-contained and ready for Plan 05 to wire behind the operator-gated `POST /admin/models/discover` endpoint: call `keyed_from_settings()` → `await discover_all(keyed)` → `compute_diff(registry_union, discovered)` → return the ephemeral diff in the HTTP response.
- SC#3 (propose-only) is unit-proven; the endpoint layer must preserve it (never auto-enable / never fill an un-returned capability) and must validate any provider selection against `set(PROVIDER_ENDPOINTS)` (Pitfall 7).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
