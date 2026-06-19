---
phase: 115-virtual-folders-agent-tool
plan: 02
subsystem: api
tags: [virtual-folders, saved-views, document-views, agent-tool, tool-dispatcher, catalog, honest-total, leak-safe, audit-reuse, pytest]

# Dependency graph
requires:
  - phase: 115-01
    provides: "document_view_resolver.resolve_filter (leak-safe in-process resolve) + ResolveError + _build_field_meta; the 6 Plan-02 GREEN-target test scaffolds"
  - phase: 113-virtual-folders-filter-compiler
    provides: "document_view_service (list_views/get_view/_uid) + ViewFilter AST + view_filter_compiler whitelist"
  - phase: 114-virtual-folders-range-date-view-builder
    provides: "_build_field_meta whitelist source (built-ins ∪ enabled custom defs)"
provides:
  - "tool_dispatcher._handle_query_documents_by_view — the one new agent tool's handler: catalog + saved-view + inline-filter modes, honest result shape (TRUE total, truncation note, source_refs), calm ResolveError/ValidationError mapping, reused search.query audit (no new enum)"
  - "document_view_service.get_view_by_name — own-or-global case-insensitive saved-view lookup (the model resolves a view by NAME, never a UUID); own-first preference; None on unknown (existence-leak guard)"
  - "_ensure_resolver() lazy-bind in tool_dispatcher — breaks the tool_dispatcher→resolver→harness.scope→task_service→tool_dispatcher import cycle while keeping the unit-test monkeypatch-where-used contract"
affects: [115-03 (registers the handler in _TOOL_REGISTRY + advertises the get_tools schema — SC#1 dual-wiring + whitelist guard), secure-phase (the live two-user leak test now drives a built handler)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polymorphic single-tool handler: three modes (catalog / saved-view / inline-filter) off a FLAT view-XOR-filter+limit arg set — no anyOf/oneOf (Gemini function-calling subset); an unknown view name routes to catalog, never a distinguishable 403 (existence-leak guard)"
    - "Honest agent answer shape: TRUE total from resolve_filter(count_only=True) (never len(shown)); explicit truncation note + truncated flag; source_refs embedded in the JSON result AND on the ToolResult so the model can cite by id+filename"
    - "Calm-error boundary at the tool edge: ResolveError + Pydantic ValidationError caught and mapped to a {status:invalid_filter, message, hint→catalog} string — an exception NEVER escapes into the agent loop"
    - "Audit reuse, no new enum: every concrete resolve fires the existing search.query audit tagged via:view/filter (D-115-10); fire-and-forget with a getattr(ctx,'spawn') guard so a duck ctx without a spawn hook never turns a clean answer into an exception"
    - "Lazy resolver bind to break a real import cycle: module-global sentinels populated on first use, preserving any monkeypatched value (patch-where-used) — cheap cycle-safe imports (ViewFilter + view/field services) stay at module scope"
    - "Name-not-into-grammar: get_view_by_name filters the already-owner-scoped list_views result in Python (no view name interpolated into a .or_()/.eq() PostgREST predicate — WR-02 surface avoided entirely)"

key-files:
  created:
    - ".planning/phases/115-virtual-folders-agent-tool/deferred-items.md"
  modified:
    - "backend/app/services/document_view_service.py"
    - "backend/app/services/tool_dispatcher.py"
    - "backend/tests/unit/test_115_handler_modes.py"
    - "backend/tests/integration/test_115_catalog.py"
    - "backend/tests/integration/test_115_saved_view_run.py"
    - "backend/tests/integration/test_115_result_shape.py"

key-decisions:
  - "Bind resolve_filter/ResolveError/_build_field_meta LAZILY via _ensure_resolver() (module-global sentinels) instead of a top-level import — a top-level import re-entered tool_dispatcher mid-load through harness.scope→task_service and crashed standalone import (ImportError: cannot import name 'ToolContext' from a partially-initialized module). The lazy bind only overwrites a None sentinel, so a test's monkeypatch.setattr(td,'resolve_filter',spy) survives (patch-where-used)."
  - "Embed source_refs INSIDE the JSON result dict (not only on the ToolResult.source_refs field) so the model reads citable {document_id, filename} pairs directly — the result-shape test asserts source_refs in the json.loads(result.result) payload, and an agent that only ever sees the result string can still cite."
  - "get_view_by_name filters list_views in Python by case-insensitive name with an own-first preference, rather than a new .or_() query with the name interpolated — eliminates the WR-02 grammar-injection surface for a view name (grep -c 'name.eq' stays 0)."

patterns-established:
  - "One agent tool, three honest modes: discover (catalog) → name a saved view → or filter inline; all caller-scoped, all bounded, all citable; errors self-correct by pointing back at the catalog."

requirements-completed: [VIEW-07]

# Metrics
duration: 28min
completed: 2026-06-19
---

# Phase 115 Plan 02: Agent-Tool Handler (catalog + saved-view + inline-filter) Summary

**Built `_handle_query_documents_by_view` — the conversational mouth of the 113/114 virtual-folders work — a single polymorphic agent-tool handler with three modes (discover the catalog / open a saved view by name / filter inline), reusing the Plan-01 leak-safe `resolve_filter` in-process to answer "open my Invoices view" / "how many contracts expire in 90 days" honestly: TRUE total, explicit truncation, caller-scoped citable rows, calm-on-error, and a reused `search.query` audit — zero new migration, zero new audit enum.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **`get_view_by_name` own-or-global lookup (Task 1):** the model resolves a saved view from a HUMAN NAME (never a UUID — D-115-6). Reuses the already-owner-scoped `list_views` and filters by case-insensitive name in Python with an own-first preference (an own view shadows a global of the same name). An unknown/unseeable name collapses to `None` so the handler routes to the catalog — never a distinguishable 403 (existence-leak guard, T-115-02-02). WR-02-safe: the name is NEVER interpolated into a `.or_()`/`.eq()` grammar (`grep -c "name.eq"` is 0).
- **`_handle_query_documents_by_view` (Task 2) — three modes off a flat `view`-XOR-`filter`+`limit` arg set** (no anyOf/oneOf — the only cross-provider-safe function-calling shape):
  - **CATALOG** (neither field, or an unknown view name): returns the caller's saved views + `filterable_fields`. The fields are sourced from `_build_field_meta` — IDENTICAL to the whitelist the compiler validates against (no drift). No resolve → no audit (lazy, cheap discovery).
  - **SAVED-VIEW** (a `view` name): `get_view_by_name` → `ViewFilter.model_validate(filter_expr)` → `resolve_filter`.
  - **INLINE-FILTER** (a `filter` object): `ViewFilter.model_validate(inline)` → `resolve_filter`.
- **Honest, agent-shaped result:** the TRUE total comes from `resolve_filter(count_only=True)` (NEVER `len(shown_rows)` — the silent-undercount trap); a `truncated` flag + a `"{total} match; {shown} newest shown."` note fire when capped; compact rows (`document_id`/`filename`/`document_type`/`date`/`author`) + `source_refs` are the caller's only (VIEW-06). `source_refs` is embedded in the JSON result AND on the `ToolResult` (citable channel; citations=[] — a VIEW listing has no chunk passage, D-115-4).
- **Calm-error boundary (T-115-02-05):** a `ResolveError` (bad/`_`-prefixed/deleted field) or a Pydantic `ValidationError` (malformed inline shape) is mapped to `{status:"invalid_filter", message, hint→catalog}` — an exception NEVER escapes into the agent loop, and the message self-corrects by pointing back at the catalog.
- **Audit reuse, no new enum (D-115-10):** every concrete resolve fires the existing `search.query` audit tagged `via:"view"`/`via:"filter"` with the matched ids (`grep -c 'action_type="search.query"'` went 1→2). Fire-and-forget with a `getattr(ctx,"spawn")` guard so a duck-typed ctx (the live integration tests build a bare `SimpleNamespace` with no `spawn`) never turns a clean answer into an exception.
- **Pitfall 4 honored:** `ctx.folder_subtree_ids` is NEVER threaded into `resolve_filter` (the view owns its `folder_scope`); the only mention is the docstring warning.
- **9/9 Plan-02 tests green live (:54322):** 3 unit handler-mode (catalog / calm-on-bad-filter / routes-to-resolve) + 1 catalog (`filterable_fields ≡ _build_whitelist`) + 4 saved-view-run (2 new `get_view_by_name` direct + saved-view-resolves + unknown→catalog) + 1 result-shape (true total 5 vs shown 2 + truncation note + shaped source_refs).

## Task Commits

1. **Task 1: `get_view_by_name` own-or-global saved-view lookup** — `5c8505f7` (feat)
2. **Task 2: `_handle_query_documents_by_view` (catalog + saved-view + inline, honest shape, reused audit)** — `d443e455` (feat)

## Files Created/Modified

- `backend/app/services/document_view_service.py` — added `get_view_by_name(name, user_id, supabase)`: own-or-global, case-insensitive, own-first, `None` on unknown; filters `list_views` in Python (no name-into-grammar).
- `backend/app/services/tool_dispatcher.py` — added `_handle_query_documents_by_view`; module-level cycle-safe imports (`ViewFilter`, `document_view_service`, `metadata_field_service`) + the `_ensure_resolver()` lazy-bind for the resolver symbols (cycle-break); reused `write_audit_entry` (already imported).
- `backend/tests/unit/test_115_handler_modes.py` — un-xfailed 3 (catalog / calm-error / routes-to-resolve).
- `backend/tests/integration/test_115_catalog.py` — un-xfailed the `filterable_fields ≡ whitelist` test.
- `backend/tests/integration/test_115_saved_view_run.py` — un-xfailed saved-view-resolves + unknown→catalog; added 2 direct `get_view_by_name` live tests (own-resolves + unknown→None).
- `backend/tests/integration/test_115_result_shape.py` — un-xfailed the true-total + truncation + source_refs test.
- `.planning/phases/115-virtual-folders-agent-tool/deferred-items.md` (new) — logged 4 pre-existing out-of-scope `get_tools` count-assertion failures.

## Decisions Made

- **Lazy resolver bind (`_ensure_resolver`) over a top-level import.** A top-level `from app.services.document_view_resolver import resolve_filter, ...` re-entered `tool_dispatcher` mid-load through `document_view_resolver → harness.scope → harness/__init__ → phase_types → task_service → tool_dispatcher` and crashed a standalone import (`ImportError: cannot import name 'ToolContext' from a partially initialized module`). The tests passed only because conftest loads `tool_dispatcher` first. The lazy bind populates module-global sentinels on first handler use and only overwrites a `None` sentinel — so a test's `monkeypatch.setattr(td, "resolve_filter", spy)` survives untouched (patch-where-used). `ViewFilter` + the view/field services stay module-level (verified cycle-safe).
- **`source_refs` embedded in the JSON `result` dict, not only on `ToolResult.source_refs`.** The result-shape test reads `source_refs` from `json.loads(result.result)`, and an agent that only ever sees the result string can still cite by id+filename. Both channels carry the same `{document_id, filename}` list.
- **`get_view_by_name` filters `list_views` in Python (own-first) rather than a new `.or_()` with the name interpolated** — removes the WR-02 grammar-injection surface for a view name entirely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import cycle on the resolver's module-level import**
- **Found during:** Task 2 (verifying acceptance criteria; the standalone `python -c "import app.services.tool_dispatcher"` crashed).
- **Issue:** The plan's `<action>` says to import `resolve_filter`/`ResolveError`/`_build_field_meta` "from `app.services.document_view_resolver`" at the handler edge. Pulling them at MODULE level re-entered `tool_dispatcher` mid-initialization via `document_view_resolver → harness.scope → harness/__init__ → phase_types → task_service → tool_dispatcher`, raising `ImportError: cannot import name 'ToolContext' from a partially initialized module`. The 9 tests still passed (conftest imports `tool_dispatcher` first), but any code path importing `tool_dispatcher` before the resolver would crash at process boot.
- **Fix:** Introduced `_ensure_resolver()` — a lazy bind into module-global sentinels (`resolve_filter = None`, etc.) called at the top of the handler. The cheap, cycle-safe imports (`ViewFilter`, `document_view_service`, `metadata_field_service`) stay at module level; only the resolver-chain symbols are deferred. The lazy bind preserves a monkeypatched value (only overwrites a `None` sentinel), so the unit-test patch-where-used contract is intact.
- **Files modified:** `backend/app/services/tool_dispatcher.py`
- **Verification:** `python -c "import app.services.tool_dispatcher as td; print(hasattr(td,'_handle_query_documents_by_view'))"` → `import ok; handler: True`; the 9-test suite stays green; the 113/114 resolver regression stays green (21 passed, 1 xfailed).
- **Committed in:** `d443e455` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — an import-cycle the plan's literal "import from the resolver" wording would have introduced at module scope).

## Issues Encountered

- **4 PRE-EXISTING out-of-scope test failures** surfaced when running the broader `-k "tool or dispatch or 115"` unit sweep: `test_explorer_agent.py::…uses_explorer_tools` / `…uses_default_tools` and `test_module7_tools.py::…without_tavily_or_sandbox` / `…with_tavily`. Verified failing on the **Plan-01 base** (stashed the Plan-02 tree, re-ran — all 4 still fail), so they are NOT caused by this plan. They assert exact `get_tools` tool counts/sets — Plan 03 owns the `get_tools` wiring and may re-baseline them. Logged to `deferred-items.md`; not fixed (SCOPE BOUNDARY).
- A benign `RuntimeWarning: coroutine 'write_audit_entry' was never awaited` appears in the unit test that uses `spawn=lambda *a, **k: None` — the lambda discards the coroutine (it never schedules it). This mirrors the existing `_handle_search_documents` audit pattern exactly; in production `ctx.spawn` is the real `_spawn` that schedules the task. No action needed.

## User Setup Required

None — no external service config, no migration (zero schema change), no new package. Pure in-process handler + service helper.

## Next Phase Readiness

- **Plan 03 (SC#1 dual-wiring + whitelist guard) is unblocked:** `_handle_query_documents_by_view` exists and is import-safe. Plan 03 registers it in `_TOOL_REGISTRY` + advertises the `get_tools` schema (flat `view` XOR `filter`+`limit`, NO anyOf/oneOf, op-enum ≡ `ViewCondition.op`) and adds the whitelist guard. Its `test_115_tool_wiring.py` / `test_115_tool_schema.py` / `test_115_whitelist_guard.py` scaffolds are the GREEN targets.
- **Secure-phase:** `test_115_tool_global_leak.py` (the two-user leak proof) now drives a BUILT handler — flip it from xfail to a live proof.
- **Plan 03 should also refresh the 4 brittle `get_tools` count assertions** noted in `deferred-items.md` (they will move again when the new tool is registered).

## Known Stubs

None — the handler is fully wired to the live resolver and view/field services; no hardcoded empty values, no placeholder data sources.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. The handler reuses the existing caller-scoped `resolve_filter` (VIEW-06) and the existing `search.query` audit; all five plan-declared STRIDE mitigations (cross-user leak, view-name existence leak, SQL/SSTI via inline filter, prompt-injected over-broad filter, error-into-loop, audit evasion) are implemented in source. The live two-user leak proof is the secure-phase non-vacuous backstop.

## Self-Check: PASSED

- `backend/app/services/document_view_service.py` (get_view_by_name): present.
- `backend/app/services/tool_dispatcher.py` (_handle_query_documents_by_view + _ensure_resolver): present.
- `.planning/phases/115-virtual-folders-agent-tool/deferred-items.md`: present.
- Commits `5c8505f7` + `d443e455`: verified in git log.
- 9/9 Plan-02 tests green live; `search.query` count 1→2; zero new migration; no file deletions in the two task commits.

---
*Phase: 115-virtual-folders-agent-tool*
*Completed: 2026-06-19*
