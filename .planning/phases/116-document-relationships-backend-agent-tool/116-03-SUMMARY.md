---
phase: 116-document-relationships-backend-agent-tool
plan: 03
subsystem: api
tags: [relationships, agent-tool, tool-dispatcher, gemini-safe-schema, leak-safe-masking, cross-provider, pytest]

# Dependency graph
requires:
  - phase: 116-01
    provides: "_resolve_readable_latest shared own-or-global latest-version resolver (FastAPI-free, called in-process for both subject + per-endpoint readability)"
  - phase: 115-virtual-folders-agent-tool
    provides: "the dual-wiring precedent (registry + get_tools), the _handle_query_documents_by_view leak-safe compact-row template, and test_115_tool_global_leak.py (the two-user leak harness)"
provides:
  - "GET_RELATED_DOCUMENTS_TOOL — Gemini-safe schema (two flat scalar-string fields, no anyOf/oneOf, no multi-type type arrays), advertised in get_tools()"
  - "_handle_get_related_documents — leak-safe both-direction read tool over document_relationships; inverse labels; per-viewer target masking; calm-string contract (never raises)"
  - "SC#1 dual-wiring: get_related_documents in BOTH _TOOL_REGISTRY AND get_tools()"
  - "LIVE non-vacuous two-user mask proof (test_116_tool_leak.py) + handler read integration (test_116_tool_read.py) green on :54322"
affects: [117-relationship-panel, 116-04-migration-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inverse-at-read directional traversal: store one directed edge, derive the inverse label (_INVERSE_LABEL, D-116-2) for incoming edges at read time"
    - "Per-viewer leak-safe masking over OWN-SCOPED edges: the tool returns the CALLER's own edges; each edge's OTHER endpoint is re-checked for caller-readability and masked as 'linked document (no access)' (D-116-9) — the RLS label is NOT the proof"
    - "Module-level import of a cycle-safe service (document_relationship_service imports only pydantic/dependencies/db/folder_utils) — no lazy _ensure_resolver dance needed (unlike the 115 view resolver which pulls harness)"

key-files:
  created: []
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_116_tool_schema.py
    - backend/tests/unit/test_116_tool_wiring.py
    - backend/tests/unit/test_116_handler.py
    - backend/tests/unit/test_tool_dispatcher.py
    - backend/tests/integration/test_116_tool_leak.py
    - backend/tests/integration/test_116_tool_read.py

key-decisions:
  - "NO read audit (RESEARCH OQ1 / A2, Claude's discretion): D-116-12 mandates an audit only for create/remove; no SC requires a read receipt; adding one would need a new enum value. A read is a pure own-graph traversal."
  - "Masking is on OWN-SCOPED edges, not cross-user edge visibility: the table is user-scoped (RESEARCH 297/351), so the tool returns the CALLER's own edges. The leak is a target on one of the caller's OWN edges that the caller can no longer read — masked per-viewer. The two-user proof therefore gives EACH user their OWN edge to the same target."
  - "Schema kept SIMPLER than 115: two flat scalar strings (document_id, filename), no nested filter object — no multi-type type arrays anywhere (the a5b0b917 Gemini trap avoided by construction)."

patterns-established:
  - "Pattern: derive-inverse-at-read directional relationship traversal (store one edge, surface both directions with inverse labels)"
  - "Pattern: per-endpoint caller-readability re-check via the shared resolver = the SOLE leak gate (RLS user-scoping is defense-in-depth, proven non-vacuous LIVE two-user)"

requirements-completed: [REL-04]

# Metrics
duration: 13min
completed: 2026-06-20
---

# Phase 116 Plan 03: get_related_documents Agent Tool Summary

**The leak-safe `get_related_documents` agent tool — a Gemini-safe two-flat-string schema dual-wired into `_TOOL_REGISTRY` AND `get_tools()`, a both-directions handler with inverse labels + per-viewer target masking ("linked document (no access)") that never raises into the loop, proven LIVE non-vacuous two-user on :54322.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-20T10:37:17Z
- **Completed:** 2026-06-20T10:51:16Z
- **Tasks:** 2
- **Files modified:** 8 (2 source + 6 test)

## Accomplishments
- **The Deep-visible agent tool (SC#1 dual-wiring):** `GET_RELATED_DOCUMENTS_TOOL` (schema) is now advertised in `get_tools()` AND `get_related_documents` is registered in `_TOOL_REGISTRY` — the model actually SEES it and `dispatch_tool` can route it (the Phase-101 half-wired bug guarded, the 115 precedent). The schema is Gemini-safe BY CONSTRUCTION: two flat `type:"string"` fields (`document_id`, `filename`), NO `anyOf`/`oneOf`, NO multi-type `type` arrays (the a5b0b917 trap); the either/or is prose-only.
- **The leak-safe both-direction handler:** `_handle_get_related_documents` resolves the subject via the SHARED `_resolve_readable_latest` (id preferred, else exact filename), runs two OWN-scoped queries (outgoing `source_doc_id == subject`, incoming `target_doc_id == subject`), and for EACH edge's OTHER endpoint re-checks caller-readability via the SAME resolver — an unseeable endpoint renders as `{"document_id": None, "filename": "linked document (no access)", ...}` (D-116-9, the SC#2 net-new behavior) and contributes NO `source_refs` entry. Incoming edges carry the inverse label (`superseded_by`/`amended_by`/`referenced_by`/`has_attachment`, D-116-2). Every failure path (no subject / unresolvable / DB error) returns a calm `ToolResult` JSON string — it NEVER raises into the agent loop (the 115 WR-01/WR-03 lesson).
- **LIVE non-vacuous two-user mask proof + handler read, green on :54322:** `test_116_tool_leak.py` drives the REAL handler with two users, each owning their OWN edge subject→target, where the target is readable to A (owner) but NOT to B — B sees the mask, A sees the real filename; non-vacuity guards assert B genuinely resolved the (global-folder) subject and the masked row is present. `test_116_tool_read.py` drives both directions + `source_refs` + the by-filename path live.
- **Net-new failures = 0** (SEED-056 base-checkout proof): base unit suite 62 failed → HEAD 60 failed (apples-to-apples, same 3 new-handler-dependent files excluded); the 2-delta are both my own registry-count lockstep updates; the fails-at-HEAD-not-base set is EMPTY. `threads.py` / the `dispatch_tool` whitelist guard / every provider service untouched (G-5, no cross-provider regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: GET_RELATED_DOCUMENTS_TOOL schema + get_tools entry; _handle_get_related_documents handler + _TOOL_REGISTRY line** - `84827bb3` (feat, TDD-green)
2. **Task 2: live non-vacuous two-user leak proof + handler read integration; registry-count lockstep 26→27** - `3980f29b` (test)

_Note: Task 1 was `tdd="true"`; the RED behavior tests existed (authored xfail/skip in Plan 01), so Task 1 is the single GREEN implementation commit that un-xfailed the schema/wiring/handler-tier-2 rows._

## Files Created/Modified
- `backend/app/services/openai_service.py` - `GET_RELATED_DOCUMENTS_TOOL` (Gemini-safe two-flat-string schema with both-directions + inverse-label description) + the `get_tools()` list entry (D-116-10 dual-wiring comment)
- `backend/app/services/tool_dispatcher.py` - module-level `document_relationship_service` import; `_INVERSE_LABEL` + `_NO_ACCESS_MASK`; `_handle_get_related_documents` (both directions, per-viewer masking, calm-string contract, no read audit); one `_TOOL_REGISTRY` line
- `backend/tests/unit/test_116_tool_schema.py` - un-xfailed (4 GREEN: no anyOf/oneOf, no multi-type arrays, two scalar strings, optional either/or)
- `backend/tests/unit/test_116_tool_wiring.py` - un-xfailed (3 GREEN: registry + get_tools dual-registration agree)
- `backend/tests/unit/test_116_handler.py` - tier-2 handler tests rewritten with a controlled in-process resolver stub (both directions + inverse labels + mask + calm errors; no live DB)
- `backend/tests/unit/test_tool_dispatcher.py` - phase-end registry-count gate advanced 26→27; `query_documents_by_view` (115) + `get_related_documents` (116) added to `EXPECTED_TOOLS`
- `backend/tests/integration/test_116_tool_leak.py` - finalized the NON-vacuous two-user mask proof (own-scoped edges; global-folder subject + private target; per-viewer mask vs real filename) — LIVE :54322
- `backend/tests/integration/test_116_tool_read.py` - finalized — drives the real handler live for both directions + source_refs + the by-filename subject path

## Decisions Made
- **No read audit (OQ1/A2):** a relationship read is a pure traversal of the caller's own graph; D-116-12 only mandates create/remove audits and no SC requires a read receipt. Adding one would need a new audit enum value (a migration) for zero benefit — skipped.
- **Masking lives on own-scoped edges:** the table is user-scoped, so the tool returns the CALLER's own edges (RESEARCH 297/351). The genuine leak is a target on one of the caller's OWN edges that the caller can no longer read (e.g. it left a global folder). Masking re-checks per-endpoint readability FROM THE CALLER, never the edge/link owner.
- **Module-level service import (no lazy bind):** `document_relationship_service` imports only pydantic/dependencies/db/folder_utils — cycle-safe at load, unlike the 115 `document_view_resolver` (which transitively pulls `harness` and needs `_ensure_resolver`). So a plain top-level import suffices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The two-user leak fixture seeded an UNREACHABLE scenario under the own-scoped edge design**
- **Found during:** Task 2 (running the live leak proof)
- **Issue:** The Plan-01 scaffold seeded ONE relationship owned by A and had user B query it, expecting B to see A's edge with the target masked. But the handler queries edges OWN-SCOPED (`.eq("user_id", caller)`) — the design the plan itself mandates (RESEARCH 297/351, threat T-116-03-05). So B, querying the subject, found ZERO edges (the edge belongs to A) → the test failed its non-vacuity guard (`total == 0`, no masked row ever rendered). The scaffold's two-user framing did not match the own-scoped contract.
- **Fix:** Redesigned the fixture to be faithful AND non-vacuous: seed BOTH users their OWN edge `subject→target` (each owns an own-scoped row → each sees it via the tool), where the SUBJECT is A's GLOBAL-folder doc (both A and B resolve it) and the TARGET is A's PRIVATE doc (only A reads it). A (target owner) sees the real filename via A's edge; B (no target access) sees the mask via B's edge. Seeding B's edge directly via service-role simulates "B linked it while visible, then it became invisible". Added two non-vacuity guards (B resolved the subject; the masked row is present).
- **Files modified:** backend/tests/integration/test_116_tool_leak.py
- **Verification:** `test_116_tool_leak.py` 2/2 PASS live on :54322; the mask demonstrably triggers for B but not A (the "static would false-green" lesson honored — this is exactly the defect the live two-user proof exists to catch).
- **Committed in:** `3980f29b` (Task 2 commit)

**2. [Rule 1 - Bug] Phase-end registry-count gate was stale at 26 after adding the 27th tool**
- **Found during:** Task 2 (full unit-suite net-new-failure proof)
- **Issue:** `test_tool_dispatcher.py::test_registry_has_exactly_26_entries` is a hard phase-end count gate; the Task-1 registry line made the registry 27 entries → the assertion broke. (The exact pattern Phase 115 hit advancing 25→26.)
- **Fix:** Advanced the gate 26→27 and renamed it; added `query_documents_by_view` (115, previously missing) + `get_related_documents` (116) to `EXPECTED_TOOLS` so the lockstep is accurate.
- **Files modified:** backend/tests/unit/test_tool_dispatcher.py
- **Verification:** `test_tool_dispatcher.py` 15/15 PASS; base-checkout proof confirms this is the only registry-driven delta and is owned by the Task-1 registry line (net-new failures still 0).
- **Committed in:** `3980f29b` (Task 2 commit)

**3. [Rule 1 - Test correctness] Tier-2 handler unit tests rewritten from MagicMock smoke to controlled-stub behavior tests**
- **Found during:** Task 1 (un-xfailing the handler tier-2 rows)
- **Issue:** The two tier-2 scaffold tests drove the real handler with conftest's MagicMock supabase, which returns un-serializable MagicMock "rows" (auto-mocked `.ilike().data[0]`) → the handler's `json.dumps` raised `TypeError: Object of type MagicMock is not JSON serializable`. The loose assertions (`"source_refs" in payload`) also wouldn't hold for a `not_found` calm string.
- **Fix:** Rewrote the tier-2 tests to monkeypatch `_resolve_readable_latest` with a controlled stub + a small `_EdgeClient` returning canned edge rows, so they deterministically assert the net-new behavior: both directions, inverse labels, the leak-safe mask, masked-row never leaks the id/filename, and the calm-string contract (no_subject / not_found). No live DB. The LIVE non-vacuous proof stays in the integration leak test.
- **Files modified:** backend/tests/unit/test_116_handler.py
- **Verification:** `test_116_handler.py` 9/9 PASS (5 tier-1 + 4 tier-2).
- **Committed in:** `84827bb3` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs — a test-fixture design mismatch, a stale phase-end count gate, and a MagicMock-vs-json tier-2 test correctness fix). No behavior/scope change to the shipped handler or schema.
**Impact on plan:** The handler, schema, dual-wiring, masking, and inverse labels are exactly as planned. Deviation 1 is the most material: the live two-user proof caught that the scaffold's masking scenario was unreachable under the plan's own-scoped edge design and made it both faithful AND non-vacuous — precisely the "static would false-green" value the live proof exists to deliver.

## Issues Encountered
- **`backend/README.md` shows `D` (deleted) in the working tree — PRE-EXISTING, not this plan.** Last committed at the 075.4 era; deleted on disk before Plan 03 started. Left untouched (SCOPE BOUNDARY) and logged to `deferred-items.md`. Never staged in either task commit.

## User Setup Required
None - no external service configuration required this plan. (Migration 075 remains authored-not-applied; Plan 04 BLOCKING applies it + regenerates `full-schema.sql` — orthogonal to this read tool, which needs no schema change.)

## Next Phase Readiness
- **Plan 04 (BLOCKING)** applies migration 075 + regenerates `full-schema.sql`. The agent tool here needs NO schema change — it reads the already-live `document_relationships` table.
- **Phase 117 (relationship panel)** can mirror this tool's both-directions + inverse-label + per-viewer-mask contract on the UI; the `_INVERSE_LABEL` map and the mask string are the shared vocabulary.
- **Verify/secure/validate gates:** the LIVE two-user leak proof is green and non-vacuous (the SC#2 acceptance bar + the T-116-03-01 secure-phase backstop); dual-wiring + Gemini-safe schema + calm-error contract are unit-proven. No blockers.

## Self-Check: PASSED

All claims verified below.

---
*Phase: 116-document-relationships-backend-agent-tool*
*Completed: 2026-06-20*
