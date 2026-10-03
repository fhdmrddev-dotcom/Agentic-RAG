---
phase: 272-close-means-wrong
plan: 02
subsystem: retrieval tool contract + chat tool card
tags: [FIND-07, search_documents, tool-schema, cross-provider, tool-card, D-02, D-03, D-04, D-05, D-08]
requires: []
provides:
  - "SEARCH_DOCUMENTS_TOOL.filters — Find's condition list {field, op, value, value2, values, unit}, op = ViewCondition.op"
  - "searchFilterLine(name, args) in frontend/src/lib/toolMeta.ts — the ONE home of the card's filter label"
  - "data-testid=search-filter-line in both ToolCallPanel row branches"
affects:
  - "272-04 (the handler that honours `filters` parses exactly this args contract)"
  - "272-05 (G-4 scenario 1 drives the card line; SC#10 board measures emission)"
tech-stack:
  added: []
  patterns:
    - "provider-safe nested tool schema: plain string scalars, no anyOf/oneOf/additionalProperties/type arrays"
    - "card text derived from persisted args, never the truncated result"
key-files:
  created:
    - backend/tests/unit/test_272_tool_schema.py
  modified:
    - backend/app/services/openai_service.py
    - frontend/src/lib/toolMeta.ts
    - frontend/src/lib/__tests__/toolMeta.test.ts
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/__tests__/components/ToolCallPanel.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "Field names in the filters description are written literally: importing document_view_resolver from openai_service closes the known harness import cycle; the test derives them from _METADATA_BUILTINS instead"
  - "value / value2 are single {type: string} (the handler coerces numbers), so the schema does not depend on Google's type-array collapse"
  - "The filter line is plain muted text (no italic/mono) placed under the essence line and beside the sub-agent line, per the sketch-findings essence vocabulary"
metrics:
  duration: "~75 min"
  completed: 2026-10-03
  tasks: 3
  files: 7
---

# Phase 272 Plan 02: Filters argument contract and the card's filter line — Summary

`search_documents` now takes Find's condition list as a `filters` argument, with an op enum equal to `ViewCondition.op` and a shape that Google's sanitizer and google-genai's `types.Tool` accept. The old "search unfiltered first, don't guess values" guidance is gone. The search tool card shows the requested filter as one visible plain line, for example "Filtered: document date 1–31 Oct 2025 · legal entity = Acme GmbH". The line is built from the persisted args in both the folded and expanded states.

PHASE_BASE: `f49d9ea2d354a42d66eb007de9d9ca6a451afe81` (asserted after `git reset --hard`; the worktree had started on `86d9559bb`).

## Baselines (measured before any edit)

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, worktree root), verbatim:
  ```
    total 9429  ·  failed 0  ·  pinned total 8674
  count gate OK — 374/374 pinned files present, no per-file decrease, 0 failing.
  ```
  Note: the run took about 12 minutes. Task 2's additive `toolMeta.ts` export (a new function with no change to existing ones) landed while it was running. No TARGETS suite reads `searchFilterLine`, and `toolMeta.test.ts` was in neither knob, so the verdict is unaffected.
- **Frontend typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): **70 errors** across 32 files (file:line:code set saved). None are in `toolMeta.ts`, `ToolCallPanel.tsx` or their two test files.

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|-----------|--------------|
| 1 | `filters` on SEARCH_DOCUMENTS_TOOL + guidance rewrite (D-03/D-02/D-05/D-04) | `4fb3d158f` | `5b671db5d` |
| 2 | `searchFilterLine` formatter (D-08) | `289ad5dac` | `5add5c26e` |
| 3 | Render in both ToolCallPanel branches + count-gate adoption (D-08) | `97a00511d` | `c9b425ebb` |

### TDD RED drives (quoted)

- **Task 1:** `8 failed` in `test_272_tool_schema.py`: 6× `KeyError: 'filters'`, `AssertionError: D-02 guidance still present: 'WITHOUT metadata_filter first'`, and `assert 'prefer \`filters\`' in 'Optional JSONB containment filter …'`.
- **Task 2:** `Failed Tests 7`. Every case failed with `TypeError: searchFilterLine is not a function`.
- **Task 3:** `Tests 3 failed | 17 passed (20)`, each with `AssertionError: expected +0 to be 1`. The fourth new case (no line for unfiltered or non-search calls) passes in RED by design and has a positive control.

## Verification

- **Backend:** `test_272_tool_schema.py test_115_tool_schema.py test_module7_tools.py test_085_tool_registration.py test_075_5_google_native.py` gave `74 passed, 2 failed`. The 2 failures are `test_module7_tools.py::TestGetTools::test_returns_base_tools_without_tavily_or_sandbox` and `::test_returns_one_more_tool_with_tavily` (tool-count asserts, `25 == 14` / `26 == 15`). **They are inherited, measured at base:** with `openai_service.py` checked out at `f49d9ea2d`, the suite read the same `2 failed, 25 passed`, and then the edited file was restored. This plan adds no tool. The `test_111_*` suites that reference the search tool also pass (5 passed).
- `grep -c "WITHOUT metadata_filter first" backend/app/services/openai_service.py` gives **0**.
- `openai_service.py` diff hunks are `@@ -23,6 +23,4 @@`, `@@ -36,0 +35,70 @@` and `@@ -40,5 +108,2 @@`. All of them sit inside the `SEARCH_DOCUMENTS_TOOL` block (base :16-52).
- `git diff f49d9ea2d -- google_service.py test_module7_tools.py test_085_tool_registration.py` is **EMPTY**.
- **Frontend suites:** `toolMeta.test.ts` + `ToolCallPanel.test.tsx` gave `Tests 47 passed (47)`.
- `grep -c 'data-testid="search-filter-line"' ToolCallPanel.tsx` gives **2**. `grep -c "searchFilterLine(" ToolCallPanel.tsx` gives **1**. `grep -c "export function searchFilterLine" toolMeta.ts` gives **1**. `new Date(` in non-comment lines of toolMeta.ts gives **0**. `grep -c "toolMeta.test.ts" scripts/vitest-count-gate.cjs` gives **3** (TARGETS + BASELINE + a comment).
- **Count gate, final** (quiet tree, no sibling run in this worktree), verbatim:
  ```
    toolMeta.test.ts                             27      27       0
    ToolCallPanel.test.tsx                       20      20       0
    total 9460  ·  failed 0  ·  pinned total 8705
  count gate OK — 375/375 pinned files present, no per-file decrease, 0 failing.
  ```
  Arithmetic, with no residual: total 9429 → 9460 = +27 (`toolMeta.test.ts` adopted, which is the gate's own printed `— 27 new`) + 4 (new ToolCallPanel cases). Pinned 8674 → 8705 = +4 (ToolCallPanel 16 → 20) + 27 (new pin).
- **tsc set diff** after all edits: 70 → 70 errors. **new: (empty) · gone: (empty).**

## Deviations from Plan

None in behavior. Two notes on method:
- The ToolCallPanel test's visibility helper also rejects a `hidden` utility class on any ancestor, in addition to `hidden`, `sr-only` and `aria-hidden`. This makes the OV-266-01 check stricter.
- `searchFilterLine` also handles a few cases the plan did not list: an unknown op renders as `label op value`; `between` without `value2` renders as `from X`; a value of `"1"` singularises the unit; the same day on both ends of `between` renders as one day. All of these are defensive. Model args are untrusted, and the function never throws.

## Known Stubs

- `filters` is **accepted and ignored** by the `search_documents` handler until **272-04** lands the handler (the plan states this; it is scoped to this phase only). Until then the card line shows what the model asked for, not what was applied (T-272-09, accepted).

## Threat surface

Nothing beyond the plan's register. T-272-06 is mitigated: there are no forbidden keys or type arrays in `filters`, and the test builds the google-genai Tool from the sanitized schema. T-272-07 is mitigated: the line is a React text child, there is no `dangerouslySetInnerHTML`, and the value is never placed in an attribute.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_272_tool_schema.py, frontend/src/lib/toolMeta.ts (searchFilterLine), ToolCallPanel.tsx (search-filter-line ×2)
- FOUND commits: 4fb3d158f, 5b671db5d, 289ad5dac, 5add5c26e, 97a00511d, c9b425ebb
- STATE.md / ROADMAP.md: untouched (orchestrator-owned)
