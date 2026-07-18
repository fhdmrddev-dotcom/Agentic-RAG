---
phase: 149-model-registry-discovery
plan: 08
subsystem: api
tags: [model-registry, calling-mode, native-tools, openrouter, starlette-routing, provider-routing, fastapi]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery (plans 03/05/06)
    provides: "_resolve_db_max_output_cap warm-cache pattern (mirrored here); _model_overrides_cache 30s TTL; PATCH/PUT /admin/models write routes; _MODEL_CAP_COLUMNS allowlist"
provides:
  - "resolve_calling_mode is DB-aware: an operator's native_tools override changes the next request's tool-calling mode (SC#1 / D-149-16), no restart, sync warm-cache read"
  - "_resolve_db_native_tools helper — sync warm _model_overrides_cache read for native_tools (mirrors _resolve_db_max_output_cap)"
  - "{model_id:path} converter on PATCH /admin/models + PUT /admin/models/.../lock so namespaced OpenRouter ids (vendor/model) route, edit, lock, and discovery-confirm-write intact"
affects: [149 live UAT (Test-1 native_tools, Test-4 OpenRouter slash-id, Test-5 OpenRouter leg), model registry write UI, provider routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-overlay-via-warm-sync-cache: hot-path resolution stays sync (no await) by reading the 30s-TTL _model_overrides_cache the async request path warms — the D-14 byte-identical boundary (native_tools now joins max_output_tokens on this pattern)"
    - "Starlette {model_id:path} converter for slash-containing (namespaced) path params, anchored by a trailing literal (/lock) — routing-only, SQL untouched"

key-files:
  created:
    - backend/tests/test_149_native_tools_routing.py
    - backend/tests/test_149_namespaced_model_routes.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/api/admin.py

key-decisions:
  - "An explicit native_tools=False override short-circuits to STRUCTURED for EVERY provider (including the OpenRouter strategy branch) — disabling native tools is the whole point of the toggle"
  - "An explicit native_tools=True flows through the existing OpenRouter strategy branch unchanged (does NOT override an xml strategy) and only settles the final static decision (effective_native)"
  - "Reproduced the two UAT failures with LITERAL-slash TestClient paths — the exact post-uvicorn-decode state Starlette routes on — so the tests are deterministic regardless of TestClient %2F handling"

patterns-established:
  - "native_tools DB overlay: _resolve_db_native_tools mirrors _resolve_db_max_output_cap byte-for-byte (lazy import, best-effort try/except, None on cold/absent/null → static fallback)"

requirements-completed: [MODEL-01, MODEL-02]

# Metrics
duration: 13min
completed: 2026-07-12
---

# Phase 149 Plan 08: Model Registry Gap-Closure (native_tools DB routing + OpenRouter slash-ID) Summary

**DB-aware `resolve_calling_mode` (an operator's native_tools toggle now changes the next request's tool-calling mode, sync warm-cache read) + `{model_id:path}` converter so all 9 namespaced OpenRouter rows route, edit, lock, and discovery-confirm-write — closing UAT Test-1 and Test-4/5.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-12T16:04:00Z
- **Completed:** 2026-07-12T16:17:53Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 source, 2 new test files)

## Accomplishments
- **SC#1 / D-149-16 closed:** `resolve_calling_mode` consults the operator's DB `native_tools` override via the same 30s-TTL warm `_model_overrides_cache` the max_output clamp uses. An operator flipping native_tools OFF now routes the next tool-carrying request through the STRUCTURED (prompt-injected) path within the TTL window, no restart. The function stays SYNC (no `await` on the hot path) — the D-14 byte-identical boundary; with no override present the mode is byte-identical to before.
- **D-149-14 / MODEL-01 / MODEL-02 closed:** `{model_id:path}` converter on `PATCH /admin/models/{model_id:path}` + `PUT /admin/models/{model_id:path}/lock` — namespaced ids (`deepseek/deepseek-chat`, all 9 OpenRouter rows) now route with the slash intact (previously every write 404'd because uvicorn ASGI-decodes `%2F`→`/` and a single-segment path param never matched). A discovery-confirmed DB-only namespaced model writes via PATCH; single-segment ids (gpt-4o) unregressed; the trailing `/lock` literal still anchors the PUT route.
- 9/9 new regression tests green, proving the exact UAT failure modes (native_tools DB-blind routing; slash-id 404) and the byte-identical / sync / no-regression guards.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED: failing native_tools routing test** — `a8d43852` (test)
2. **Task 1 GREEN: DB-aware calling-mode resolution** — `56945cca` (feat)
3. **Task 2 RED: failing namespaced-route test** — `0e9cc98d` (test)
4. **Task 2 GREEN: {model_id:path} converter** — `3afc53e3` (feat)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP + deferred-items)

## Files Created/Modified
- `backend/app/services/openai_service.py` — added `_resolve_db_native_tools` (sync warm-cache read); wired it into `resolve_calling_mode` (explicit False → STRUCTURED for every provider; explicit True/None → effective-value / byte-identical static fallback). Stays `def` (sync).
- `backend/app/api/admin.py` — two route decorator path strings: `{model_id}` → `{model_id:path}` on the PATCH capability write and the PUT lock route. Handler bodies unchanged (SQL still parameterized upsert + code-constant allowlist).
- `backend/tests/test_149_native_tools_routing.py` (new) — 5 tests: db_native False→STRUCTURED (the UAT Test-1 repro), no-override byte-identical, db_native True flips a static-False model, null native_tools column falls back, resolve_calling_mode-stays-sync guard.
- `backend/tests/test_149_namespaced_model_routes.py` (new) — 4 tests: PATCH namespaced routes intact, discovery-confirm namespaced write, single-segment unregressed, PUT `/lock` namespaced routes intact.

## Decisions Made
- **native_tools=False wins for every provider.** An explicit disable short-circuits to STRUCTURED before the OpenRouter strategy branch — it is the operator control's entire purpose. An explicit True does NOT override an `xml` OpenRouter strategy; it only settles the final static decision (`effective_native = db_native if db_native is not None else cap["native_tools"]`, which collapses to the pre-149 expression when there is no override).
- **Literal-slash test paths.** The routing tests drive `client.patch("/admin/models/deepseek/deepseek-chat")` (literal slash) rather than `%2F`, because a literal slash is exactly the post-uvicorn-ASGI-decode path Starlette routes on — deterministic and faithful to the production bug, independent of TestClient percent-decoding behavior.

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented per their `<action>` specs; all acceptance criteria met.

## Issues Encountered

- **Out-of-scope pre-existing failure (logged, not fixed):** `tests/integration/test_extraction_dispatcher.py::...test_per_call_hint_respects_admin_disable` surfaced in a broad `-k "...or admin"` regression sweep (its name contains "admin"). It drives `POST /documents/{id}/reextract` and returns 503 Service Unavailable — it needs live extraction/DB services this env lacks, and **fails identically in isolation (fresh process)**, so it is unrelated to this plan's changes (which touch only `resolve_calling_mode` + the two `admin.py` model-route decorators). Logged to `149-.../deferred-items.md` per the SCOPE BOUNDARY rule; not fixed.

## Threat Flags

No new threat surface. Per the plan's `<threat_model>`: T-149-22/23 (inert control / shared-path regression) mitigated by the additive+sync native_tools overlay; T-149-24 (SQLi via routed slash) mitigated because `{model_id:path}` changes routing ONLY — model_id continues into the already-parameterized upsert + code-constant `_MODEL_CAP_COLUMNS`/`save_app_settings` allowlist (no new injection surface); T-149-25 (EoP) — both routes still inherit the router-level `require_operator` 404 gate untouched. No new packages.

## User Setup Required

None - no external service configuration required. (No migration; behavior is live on the existing mig-053 read overlay + Phase 149 write routes.)

## Next Phase Readiness
- The two MAJOR backend request-path UAT gaps (Test-1 native_tools DB-blind routing; Test-4 OpenRouter slash-ID 404, and thus Test-5's OpenRouter leg) are code-closed and unit-proven. Ready to fold into the Phase 149 live cross-provider UAT (149-HUMAN-UAT.md) alongside gap plans 09/10.
- No blockers. The overdue `threads.py` G-5 extraction remains a standing item (unrelated to this plan).

## Self-Check: PASSED

- Files: all 4 FOUND (2 source modified, 2 test files created).
- Commits: a8d43852, 56945cca, 0e9cc98d, 3afc53e3 all FOUND in git history.
- Verification: `pytest tests/test_149_native_tools_routing.py tests/test_149_namespaced_model_routes.py` → 9 passed. In-scope regression `-k "149 or model_gate"` (unit) → 69 passed.

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
