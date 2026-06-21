---
phase: 115-virtual-folders-agent-tool
plan: 03
subsystem: api
tags: [virtual-folders, saved-views, document-views, agent-tool, tool-schema, dual-wiring, cross-provider, gemini-safe, whitelist-guard, leak-proof, pytest]

# Dependency graph
requires:
  - phase: 115-02
    provides: "tool_dispatcher._handle_query_documents_by_view (catalog + saved-view + inline-filter handler, import-safe via _ensure_resolver lazy bind) + the 6 Plan-03 GREEN-target test scaffolds"
  - phase: 115-01
    provides: "document_view_resolver.resolve_filter (leak-safe in-process resolve) + ResolveError; the two-user tool-leak proof scaffold (already drives the handler)"
  - phase: 085-agent-loop-tools
    provides: "the get_tools() default assembly + the dispatch_tool phase_whitelist guard (HARNESS-05) the tool obeys for free"
provides:
  - "QUERY_DOCUMENTS_BY_VIEW_TOOL — the cross-provider-safe (no anyOf/oneOf) tool schema constant in openai_service.py: flat view XOR filter + limit, op-enum ≡ ViewCondition.op, advertised in get_tools() (the SC#1 second wiring site, Deep-visible)"
  - "the _TOOL_REGISTRY entry query_documents_by_view → _handle_query_documents_by_view in tool_dispatcher.py (the SC#1 first wiring site — the INVERSE of render_template, which is registered but NOT advertised)"
  - "the live two-user leak proof (test_115_tool_global_leak.py) and the SC#2 whitelist-guard unit test (test_115_whitelist_guard.py) un-xfailed and GREEN live on :54322 — the non-vacuous T-115-03-01/02 backstops"
affects: [secure-phase (the live leak test + whitelist guard now run as real passes, not xfail), VALIDATION SC#10 cross-provider UAT (the schema the model must actually invoke live)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SC#1 inverse-Phase-101 dual-wiring: an agent tool is BOTH registered in _TOOL_REGISTRY (so dispatch_tool can route it) AND advertised in get_tools() (so the model SEES the schema). render_template is the deliberate INVERSE (registered, NOT advertised → harness-only). 'registered' alone is a silent dead tool."
    - "Cross-provider-safe polymorphic tool argument: 'saved-view-by-name XOR inline-filter XOR catalog' expressed with TWO genuinely-optional FLAT fields (view: string, filter: object) + the either/or invariant in PROSE — NEVER anyOf/oneOf (Gemini function-calling rejects them, RESEARCH Pitfall 1). value uses a JSON-Schema type-array (['string','number','boolean','null']), not anyOf."
    - "Op-enum parity by construction: the nested filter.conditions[].op.enum is the exact ViewCondition.op Literal value set, so the model-filled object validates against ViewFilter.model_validate(...) with no translation; a unit test asserts set-equality (no silent drift)."
    - "SC#2 free by NOT special-casing: the new tool is never branched around the dispatch_tool phase_whitelist guard — excluded → tool_not_available_in_phase refusal; included / None(Deep) → dispatches. The guard is generic; the tool inherits it."
    - "Static would false-green → verify leak-safety LIVE: the two-user leak proof drives the REAL handler (_handle_query_documents_by_view), not the route resolve_view nor an RLS-policy label, against live :54322 — disjoint per-caller result sets are the only non-vacuous proof of the agent-path leak boundary."

key-files:
  created: []
  modified:
    - "backend/app/services/openai_service.py"
    - "backend/app/services/tool_dispatcher.py"
    - "backend/tests/unit/test_115_tool_wiring.py"
    - "backend/tests/unit/test_115_tool_schema.py"
    - "backend/tests/unit/test_115_whitelist_guard.py"
    - "backend/tests/integration/test_115_tool_global_leak.py"

key-decisions:
  - "Placed QUERY_DOCUMENTS_BY_VIEW_TOOL immediately after QUERY_DOCUMENTS_TOOL in openai_service.py (the natural retrieval-tool cluster) and added it as the 3rd entry in the get_tools() assembly list (right after QUERY_DOCUMENTS_TOOL) — keeps the contrast-trio (search_documents / query_documents / query_documents_by_view) adjacent for both human readers and the model's tool ordering. apply_tool_budget only trims on the HARNESS path (Google max_tools:16); Deep stays byte-identical with the tool present (D-115-8)."
  - "The SC#2 whitelist-guard unit test (test_115_whitelist_guard.py) and the live two-user leak proof (test_115_tool_global_leak.py) were ALREADY fully authored as Wave-0 scaffolds (Plan 01) with complete bodies that drive the real handler — Plan 03's Task 2 was strictly to un-xfail them, not to rewrite. The whitelist tests in fact already XPASSed at the Plan-02 base (the excluded-case fires the generic guard; the included/None cases monkeypatch a spy handler). Un-xfailing them just turns XPASS into PASS — no body change needed beyond a stale-docstring refresh on the leak test."
  - "Did NOT touch the 4 pre-existing out-of-scope get_tools count-assertion tests (test_explorer_agent.py x2, test_module7_tools.py x2). They assert a stale Phase-085-era count (15/16) and already fail at base (get_tools returns 21 base tools at e0278fa2, well over their assertion). My change shifts the base count 21→22 — the delta moves but the failure is pre-existing and identical-in-kind. SCOPE BOUNDARY: they are not in this plan's files_modified; logged to deferred-items.md in Wave 2; left for a dedicated count-assertion refresh."

patterns-established:
  - "One tool, two wiring sites, never special-cased: register it, advertise it, let the generic guard police it. The schema is the only model-facing surface, so it carries the contrast-with-search_documents routing and the either/or invariant in prose — the model needs no out-of-band knowledge."

requirements-completed: [VIEW-07]

# Metrics
duration: 14min
completed: 2026-06-19
---

# Phase 115 Plan 03: SC#1 Dual-Wiring Keystone Summary

**Landed the SC#1 dual-wiring that closes the inverse-Phase-101 visibility bug: defined the cross-provider-safe `QUERY_DOCUMENTS_BY_VIEW_TOOL` schema (flat `view` XOR `filter` + `limit`, NO anyOf/oneOf, op-enum ≡ `ViewCondition.op`) and wired it into BOTH `_TOOL_REGISTRY` AND `get_tools()` so the Deep-mode model actually SEES and CALLS the 113/114 virtual-folders tool — then proved SC#2 is free (the dispatch guard refuses an excluded tool with zero special-casing) and ran the two-user cross-user leak proof LIVE against `:54322` driving the real handler: disjoint per-viewer result sets, differing totals, no filename leak, unknown-view → catalog (never 403). threads.py byte-untouched; zero new migration; zero new audit enum.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- **SC#1 dual-wiring (Task 1) — the keystone.** Defined the module-level `QUERY_DOCUMENTS_BY_VIEW_TOOL` constant in `openai_service.py` (verbatim from `115-RESEARCH.md:144-216`) and wired it into the two SC#1 sites:
  - **First site (registry):** one line in `tool_dispatcher._TOOL_REGISTRY` mapping `query_documents_by_view → _handle_query_documents_by_view` (the inverse of `render_template`, which is registered but NOT advertised — harness-only). `dispatch_tool` can now route the call.
  - **Second site (advertised schema):** added to the `get_tools()` default assembly as the 3rd entry (after `query_documents`), Deep-visible by default. The model now SEES the schema → can emit the call (this is exactly the leg Phase 101's `render_template` bug dropped).
- **Cross-provider-safe schema shape (Gemini lock, D-115-13).** The schema uses two genuinely-optional FLAT fields (`view: string`, `filter: object`) + an optional `limit: integer`, with the either/or invariant stated in PROSE in the description ("Provide EXACTLY ONE of `view` OR `filter` … Provide NEITHER to discover … Never provide both"). NO `anyOf`/`oneOf` anywhere (Gemini function-calling rejects them); the polymorphic `value` field uses a JSON-Schema type-array `["string","number","boolean","null"]`, not `anyOf`. The nested `filter.conditions[].op.enum` is the exact `ViewCondition.op` Literal value set (`eq/gte/lte/one_of/contains/is_empty/within_next/older_than/before/after/between`) and the `unit.enum` is `["days","weeks","months"]` — so a model-filled object validates against `ViewFilter.model_validate(...)` with zero translation. The description contrasts the tool with `search_documents` (NL query + ranked top-K) and `query_documents` (free SQL) so the model routes correctly (D-115-5).
- **SC#2 is free — proven, not asserted (Task 2).** Un-xfailed `test_115_whitelist_guard.py` (3 tests): a `phase_whitelist` EXCLUDING the tool → `dispatch_tool` returns the clean `tool_not_available_in_phase` refusal envelope; INCLUDING it → it dispatches to its handler; `None` (Deep) → it dispatches (the guard is a no-op). The tool is never branched around the guard — it inherits the generic Phase-091 HARNESS-05 gate.
- **The live two-user leak proof drives the REAL handler (T-115-03-01, non-vacuous).** Un-xfailed `test_115_tool_global_leak.py` (2 tests) — already fully authored in Wave 0 to drive `_handle_query_documents_by_view(args, ctx)` (NOT the route `resolve_view`, NOT an RLS-policy label). Seeds two users + ONE shared `is_global=true` view (`document_type=invoice`) + per-user matching/non-matching docs, then calls the handler once per caller and asserts: (a) A sees ONLY A's 2 invoices, B sees ONLY B's 1; (b) the `total`s differ (2 vs 1) AND the id sets differ; (c) no id or filename leaks across callers (`isdisjoint`); (d) an unknown view name → `catalog` (404-equivalent, never 403, never another user's data). **Ran LIVE against `:54322` (not skipped) — a real pass, the "static would false-green" lesson honored.**
- **G-5 + scope invariants held:** `threads.py` byte-untouched, zero new SQL migration (D-115-11), zero new audit enum, no provider service touched. Only the two SC#1 wiring sites + the 4 test files moved.

## Task Commits

1. **Task 1: dual-wire `query_documents_by_view` (registry + get_tools, SC#1)** — `cdcc64ae` (feat)
2. **Task 2: un-xfail SC#2 whitelist guard + live two-user leak proof** — `9a02d6e6` (test)

## Files Created/Modified

- `backend/app/services/openai_service.py` — added the `QUERY_DOCUMENTS_BY_VIEW_TOOL` schema constant (after `QUERY_DOCUMENTS_TOOL`) + the `get_tools()` assembly entry (the SC#1 second wiring site, Deep-visible).
- `backend/app/services/tool_dispatcher.py` — one line in `_TOOL_REGISTRY`: `"query_documents_by_view": _handle_query_documents_by_view` (the SC#1 first wiring site; G-5 comment; threads.py untouched).
- `backend/tests/unit/test_115_tool_wiring.py` — un-xfailed 3 (registered / advertised / registry-schema-agree); removed now-unused `pytest` import.
- `backend/tests/unit/test_115_tool_schema.py` — un-xfailed 3 (no anyOf/oneOf / view+filter optional / op-enum ≡ ViewCondition.op); removed now-unused `pytest` import.
- `backend/tests/unit/test_115_whitelist_guard.py` — un-xfailed 3 (excluded refuses / included dispatches / None dispatches — SC#2 free).
- `backend/tests/integration/test_115_tool_global_leak.py` — un-xfailed 2 (per-viewer disjoint sets / unknown-view → catalog), driving the real handler live on `:54322`; refreshed the stale "kept xfail" module docstring to "now runs live".

## Decisions Made

- **Tool placement keeps the contrast-trio adjacent.** `QUERY_DOCUMENTS_BY_VIEW_TOOL` sits right after `QUERY_DOCUMENTS_TOOL` (definition) and is the 3rd `get_tools()` entry — so `search_documents` / `query_documents` / `query_documents_by_view` are neighbours for both the human reader and the model's tool ordering, reinforcing the description's routing contrast (D-115-5).
- **Task 2 was un-xfail, not author.** The SC#2 whitelist test and the live leak proof were already complete Wave-0 scaffolds with bodies that drive the real handler and build per-caller ctx stubs. The whitelist trio in fact already XPASSed at the Plan-02 base. Plan 03's job was to flip them from xfail to real passes — no body rewrite needed beyond a stale-docstring refresh.
- **The 4 pre-existing get_tools count-assertion failures were left untouched (SCOPE BOUNDARY).** See Issues Encountered.

## Deviations from Plan

None — both tasks executed exactly as written. (Two purely-cosmetic, in-file cleanups were applied while un-xfailing: removing the now-unused `pytest` import from `test_115_tool_wiring.py` and `test_115_tool_schema.py` after their last `@pytest.mark.xfail` decorator was deleted, and refreshing the leak-test module docstring from "kept xfail" to "runs live". Neither changes behavior or scope.)

## Issues Encountered

- **4 PRE-EXISTING out-of-scope `get_tools` count-assertion failures** (flagged in the plan's `<known_preexisting_failures>` and logged to `deferred-items.md` in Wave 2): `test_explorer_agent.py::…uses_explorer_tools` / `…uses_default_tools` and `test_module7_tools.py::…without_tavily_or_sandbox` / `…with_tavily`. These assert a stale Phase-085-era count (15 / 16 tools). **Proven pre-existing:** at the Plan-02 base commit `e0278fa2`, `get_tools()` already returns **21** base tools (re-derived directly from the base-committed file) — well over the 15/16 they assert — so all 4 fail identically-in-kind BEFORE any 115-03 change. My change shifts the base count 21→22, so the assertion delta moves but the failure does not (still `!= 15/16`). They are NOT in this plan's `files_modified`; per the SCOPE BOUNDARY they were left untouched. **Recommended follow-up:** a small dedicated refresh of these 4 count assertions to the current toolbox size (`get_tools()` base = 22 after this plan) — out of scope here to avoid silently editing test files outside the plan register.
- The live-Supabase integration tests emit benign `DeprecationWarning: The 'verify' parameter is deprecated` (supabase-py) and a `RuntimeWarning` on the discard-the-audit-coro lambda — both are pre-existing patterns mirrored from the Plan-02 handler tests; no action needed.

## User Setup Required

None — no external service config, no migration (zero schema change), no new package. Pure schema constant + one registry line + test un-xfails.

## Next Phase Readiness

- **Phase 115 is feature-complete:** the one new agent tool (`query_documents_by_view`) is dual-wired (SC#1), cross-provider-safe (no anyOf/oneOf, op-enum parity), whitelist-policed for free (SC#2), and the two-user leak proof drives the real handler and passes live (the secure-phase non-vacuous backstop).
- **Secure-phase** runs `test_115_tool_global_leak.py` + `test_115_whitelist_guard.py` as REAL passes (no longer xfail) — the live `:54322` two-user leak proof is the T-115-03-01 gate.
- **VALIDATION SC#10 cross-provider UAT** is the remaining live acceptance: the model must ACTUALLY invoke `query_documents_by_view` across the native roster (the SC#1 acceptance bar is the model calling it, not merely the registry containing it).
- **Open follow-up (out of scope here):** refresh the 4 brittle `get_tools` count assertions in `test_explorer_agent.py` / `test_module7_tools.py` to the current toolbox size (logged in `deferred-items.md`).
- No blockers.

## Known Stubs

None — the tool is fully wired to the live handler (Plan 02) and the live resolver (Plan 01); no hardcoded empty values, no placeholder data sources, no unwired schema.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. The tool reuses the existing caller-scoped `_handle_query_documents_by_view` (which reuses the leak-safe `resolve_filter`, VIEW-06) and the existing `search.query` audit; it inherits the generic `dispatch_tool` `phase_whitelist` guard with no special-casing. All four declared STRIDE mitigations (T-115-03-01 cross-user leak, T-115-03-02 phase-whitelist EoP, T-115-03-03 cross-provider-unsafe schema, T-115-03-04 registered-but-not-advertised) are implemented and test-backed; the live two-user leak proof is the secure-phase non-vacuous backstop.

## Self-Check: PASSED

- `backend/app/services/openai_service.py` — `QUERY_DOCUMENTS_BY_VIEW_TOOL` defined (grep ≥ 2: constant + get_tools entry): verified.
- `backend/app/services/tool_dispatcher.py` — `"query_documents_by_view": _handle_query_documents_by_view` registry line (grep == 1): verified.
- SC#1 advertised: `get_tools()` contains `query_documents_by_view` — verified live.
- Gemini-safe: no `anyOf`/`oneOf` in the schema JSON — verified live.
- Full phase 115 suite: 23 passed, 1 xfailed (the intentional Plan-01 live-bad-field xfail) — verified live on `:54322`.
- The live two-user leak proof RAN (not skipped) and PASSED — verified.
- `threads.py` byte-untouched (G-5); zero new migration (D-115-11) — verified.
- Commits `cdcc64ae` + `9a02d6e6`: present in git log; no file deletions in either.

---
*Phase: 115-virtual-folders-agent-tool*
*Completed: 2026-06-19*
