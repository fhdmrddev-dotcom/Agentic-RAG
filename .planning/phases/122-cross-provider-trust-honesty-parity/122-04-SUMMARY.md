---
phase: 122-cross-provider-trust-honesty-parity
plan: 04
subsystem: api
tags: [system-prompt, agent-loop, workspace-panel, cross-provider, honesty, tdd]

# Dependency graph
requires:
  - phase: 095.1
    provides: the deterministic workspacePanel humanize()/inferLabel() label floor + tool_args_progress cross-provider plumbing
  - phase: 101
    provides: the execute_code.description tool-schema field (openai_service.py:601-603 — already strong)
provides:
  - "An ungated, provider-agnostic execute_code.description nudge in the shared SYSTEM_PROMPT (D-122-08): the model is instructed to ALWAYS set a short, specific label of what its code produces, never a generic 'Run code'"
  - "A string-presence guard test pinning the exact nudge phrase so it cannot be silently deleted from the G-5 hot file agent_loop.py"
  - "A frontend label-floor test verifying (not rebuilding) the humanize() precedence chain + the load-bearing bare-name floor the SC#10 UAT watches"
affects: [122-03 MP-03 scoreboard SC#10 UAT, 128 TDP-02 live description streaming, cross-provider task labels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ungated provider-agnostic prompt nudge (one additive string in the shared SYSTEM_PROMPT — lifts weak-labeling providers, cannot regress well-behaved ones, never branches by provider)"
    - "VERIFY-not-rebuild test discipline: export a module-private function (one word) to pin existing behavior rather than re-implementing it"

key-files:
  created:
    - backend/tests/unit/test_system_prompt.py
    - frontend/src/lib/workspacePanel.test.ts
  modified:
    - backend/app/services/agent_loop.py
    - frontend/src/lib/workspacePanel.ts

key-decisions:
  - "TDP-01 is a PROMPT problem, not a schema problem — the execute_code.description schema field (openai_service.py:601-603) is already strong; the fix is one ungated nudge bullet in SYSTEM_PROMPT (D-122-08)"
  - "No Anthropic-specific extraction added — BUG-260528-03's stated cause is WRONG; tool_args_progress is already cross-provider in all 3 adapters, so the shared nudge is the correct lever"
  - "humanize() exported (one word, no behavior change) to test the bare-name floor directly — no current MEANINGFUL_TOOL is also absent from PRETTY_TOOL_NAMES, so the ?? name floor can only be exercised via a direct humanize() call"
  - "PRETTY_TOOL_NAMES NOT pre-emptively extended — per D-122-08, the floor extends only if the SC#10 UAT actually surfaces a bare name; this plan only documents the floor with an assertion"

patterns-established:
  - "One additive string + a string-presence guard is the minimal touch for a G-5 hot file (agent_loop.py SYSTEM_PROMPT)"
  - "The bare-name floor (PRETTY_TOOL_NAMES[name] ?? name) is the surface the SC#10 cross-provider UAT watches — assert it, never blank/generic"

requirements-completed: [TDP-01]

# Metrics
duration: 5min
completed: 2026-06-23
---

# Phase 122 Plan 04: TDP-01 Cross-Provider Task-Label Parity Summary

**One ungated provider-agnostic SYSTEM_PROMPT nudge driving a specific execute_code.description on every provider, pinned by a string-presence guard, with the existing frontend humanize() label floor + bare-name fallback verified (not rebuilt).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-23T03:59:38Z
- **Completed:** 2026-06-23T04:04:03Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Added the ungated `execute_code.description` nudge to the shared `SYSTEM_PROMPT` — a single provider-agnostic bullet telling the model to ALWAYS set a short, specific label (e.g. "Generating Q3 revenue chart"), never a generic "Run code", noting the user sees it live in the workspace panel. Lifts providers that label poorly; cannot regress those that already do (D-122-08, SC#4).
- Pinned the nudge with a string-presence guard test (`test_system_prompt.py`) so a silent deletion or watering-down fails CI (T-122-04-01 mitigation). A second test asserts the nudge stays provider-agnostic (no `anthropic`/`tool_args_progress` leak).
- Verified the existing frontend label floor (`workspacePanel.test.ts`, 10 assertions): the `humanize()` precedence chain (execute_code → description > inferLabel(code) > "Run code") and the load-bearing bare-name floor — a non-mapped tool renders its raw snake_case name, the exact surface the SC#10 UAT watches (Pitfall 4).

## Task Commits

Each task was committed atomically (both TDD — RED proven before GREEN):

1. **Task 1: Add the ungated execute_code.description nudge + string-presence guard** - `2b080ed0` (feat) — RED confirmed (`description` absent from SYSTEM_PROMPT) → nudge added → GREEN
2. **Task 2: Verify the frontend label floor (humanize precedence + bare-name)** - `f55a67fd` (test) — RED confirmed (`humanize is not a function`) → `export` added → GREEN 10/10

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `backend/app/services/agent_loop.py` - Appended ONE ungated bullet to the `execute_code` guidance in `SYSTEM_PROMPT` instructing a specific `description` (no logic change; G-5 minimal touch)
- `backend/tests/unit/test_system_prompt.py` - NEW: string-presence guard pinning the nudge phrase + a provider-agnostic guard
- `frontend/src/lib/workspacePanel.ts` - Exported `humanize` (one word; no behavior change) so the bare-name floor can be asserted directly
- `frontend/src/lib/workspacePanel.test.ts` - NEW: 10 vitest assertions verifying inferLabel/humanize precedence + the bare-name floor (verify, not rebuild)

## Decisions Made
- **TDP-01 = prompt, not schema.** The schema field was already strong (`openai_service.py:601-603`); left untouched. The lever is the shared prompt nudge (D-122-08).
- **No Anthropic-specific extraction.** BUG-260528-03's stated cause (Anthropic-only extraction) is wrong — `tool_args_progress` is already cross-provider in all 3 adapters. The ungated shared-prompt nudge is the correct, provider-agnostic fix.
- **Exported `humanize` to test the floor directly.** The `?? name` bare-name floor lives inside `humanize()`; no current `MEANINGFUL_TOOLS` member is absent from `PRETTY_TOOL_NAMES` (the only meaningful tool not in the map is `execute_code`, which has its own branch), so `deriveWorkspacePanel()` alone cannot exercise the floor. Exporting `humanize` is the minimal verify path the plan permits.
- **Did NOT extend `PRETTY_TOOL_NAMES`.** Per D-122-08 the floor extends only if the SC#10 UAT surfaces a real bare name; this plan documents the floor with an assertion rather than pre-building a per-tool summarizer.

## Deviations from Plan

None - plan executed exactly as written. (Both tasks followed the planned TDD flow; the nudge sentence matches the 122-PATTERNS.md recommendation; the frontend test verifies the existing floor without rebuilding it.)

## Issues Encountered
- **Pre-existing out-of-scope frontend failure (NOT fixed):** `frontend/src/lib/model-info.test.ts:57` asserts `MODEL_INFO["gpt-4o"]?.costTier === "high"` but receives `"mid"` — model-registry data drift (Phase 096 D-05 re-curation). UNRELATED to Plan 04: `model-info.test.ts` does not import `workspacePanel.ts`, `model-info.ts` is untouched, and the `humanize` export introduces no type errors. Logged to `deferred-items.md` per the SCOPE BOUNDARY rule; left for a model-registry data-sync fix. The full `src/lib/` suite is otherwise 95/96 green (the 1 failure is this pre-existing item).

## User Setup Required
None - no external service configuration required. (No DB migration, no package install, no env var.)

## Next Phase Readiness
- TDP-01 substrate is in place: the nudge ships in the shared prompt and the label floor is pinned. The live cross-provider proof (NO provider shows a bare tool name) is the SC#10 UAT, which Plan 122-03's forced-emit scoreboard / VALIDATION.md carries.
- Forward seam for STRETCH Phase 128 (TDP-02 — stream the description live before tool_start): the description field the model now reliably fills is the same field 128 would stream early.
- No blockers introduced. Red line D-14 held: Deep Mode prompt change is purely additive and provider-agnostic; no shared-path fork.

## Self-Check: PASSED

- FOUND: `backend/tests/unit/test_system_prompt.py`
- FOUND: `frontend/src/lib/workspacePanel.test.ts`
- FOUND: `.planning/phases/122-cross-provider-trust-honesty-parity/122-04-SUMMARY.md`
- FOUND: commit `2b080ed0` (Task 1)
- FOUND: commit `f55a67fd` (Task 2)

---
*Phase: 122-cross-provider-trust-honesty-parity*
*Completed: 2026-06-23*
