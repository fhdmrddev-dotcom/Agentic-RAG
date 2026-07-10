---
phase: 124-workflow-studio-ux-soul-strict-loose
plan: 01
subsystem: ui
tags: [react, vitest, tdd, workflows, soul, deriveTier, phase-spine, tier-chip, glyph-map]

# Dependency graph
requires:
  - phase: 103-workflows-page-authoring
    provides: "deriveTier.ts (TIERS + deriveTier), the PHASE_GLYPHS vocabulary, WorkflowsPage tierForDefinition/entryInputKeys/DefShape donor helpers, the PhaseSpineGraph emit-tint + ?raw G-5 idiom"
provides:
  - "soulData.ts — the ONE shared soul-data module (tierForDefinition + PHASE_GLYPHS + entryInputKeys + soulDeliverable + DefShape)"
  - "WorkflowSoul.tsx — the scale-keyed 5-atom soul (card | run | pub) with honest empty-states"
  - "PhaseSpine.tsx — the horizontal glyph-dot spine (ribbons + indices stripped, ◆ emit tinted)"
affects: [124-02, 124-03, WorkflowsPage card re-skin, WorkspacePanel run-header, PublishGauntlet publish-summary soul block, WorkflowDoorSwitch govern door]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared soul-data module: tier + glyph + needs + deliverable derived ONCE, consumed by all 3 soul sizes (no per-size duplication — the SC#1+SC#2 consistency invariant)"
    - "Scale-keyed atom: one renderer per atom, scale prop tunes layout/typography ONLY; data + derivation identical across card/run/pub"
    - "Honest always-rendered empty-states (D-03): null purpose -> 'draft · purpose not declared yet'; no llm_emit -> 'produces: answer in chat' (never hidden, never fabricated)"
    - "?raw source-grep G-5 backstop on the run-soul component (mirrors PhaseSpineGraph.test.tsx)"

key-files:
  created:
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/soulData.test.ts
    - frontend/src/components/workflows/WorkflowSoul.tsx
    - frontend/src/components/workflows/WorkflowSoul.test.tsx
    - frontend/src/components/workflows/PhaseSpine.tsx
    - frontend/src/components/workflows/PhaseSpine.test.tsx
  modified: []

key-decisions:
  - "soulDeliverable derives the file label from the workflow name + ' · file' (honest, non-empty, non-fabricated) — the EXACT friendly label string (A1) is flagged for manual UAT confirmation against sketch 046-A, not a hard assertion"
  - "soulData.ts surfaces existing definition fields only — no @/lib/api import, no migration, no backend touch (D-02)"
  - "PhaseTimeline.tsx / PhaseCard.tsx kept byte-identical (git diff --stat empty) — the soul is a sibling, never an internal edit (G-5 / D-07)"

patterns-established:
  - "Single tier derivation source: all soul sizes call soulData.tierForDefinition -> deriveTier; the chip is always computed, never a stored label (D-02 / D-04)"
  - "Glyph-dot spine deltas (046-A): type ribbons + phase-index numbers STRIPPED; ◆ emit node accent-violet tinted; name in title= at card / visible quiet label at run+pub"

requirements-completed: [WUX-01]

# Metrics
duration: ~9min
completed: 2026-06-26
---

# Phase 124 Plan 01: Workflow Soul Foundation Summary

**One shared `soulData` module (tier + glyph-map + needs + honest deliverable) plus the two net-new presentation components — `WorkflowSoul` (scale-keyed 5-atom soul) and `PhaseSpine` (ribbon/index-free glyph-dot row) — making the SC#1+SC#2 cross-size consistency invariant testable before any host surface mounts the soul.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-26T20:50Z
- **Completed:** 2026-06-26T20:58Z
- **Tasks:** 2 (both TDD)
- **Files created:** 6

## Accomplishments

- Extracted the duplicated `tierForDefinition` + the 3 duplicate `PHASE_GLYPHS` copies into ONE shared `soulData.ts` so the library card / run header / publish summary can never render disagreeing tiers or glyphs (D-02, SC#1+SC#2).
- Added the honest `soulDeliverable` resolver (D-03): a terminal `llm_emit` phase → `{ kind: "file", label }`; none → `{ kind: "chat" }` (the locked "produces: answer in chat" signal). Never fabricates a deliverable name.
- Built `WorkflowSoul` — the scale-keyed 5-atom soul (purpose HERO · needs · glyph-dot spine · ONE tier chip glyph+WORD · output) with identical data/derivation across card/run/pub and honest always-rendered empty-states.
- Built `PhaseSpine` — the horizontal glyph-dot row with type ribbons + phase-index numbers stripped (046-A) and the `◆` emit node accent-violet tinted.
- Pinned the tier-consistency invariant (same `data-tier` at card/run/pub) and the G-5 source-grep with vitest; `PhaseTimeline.tsx`/`PhaseCard.tsx` proven byte-identical.

## Task Commits

Each task was committed atomically (TDD: the failing test + the implementation landed in one commit per task after the RED→GREEN cycle):

1. **Task 1: Extract the shared soulData module** - `0946bb54` (feat) — RED (test resolve-fail) → GREEN (14/14 specs)
2. **Task 2: WorkflowSoul + PhaseSpine** - `c5a6c610` (feat) — RED (component resolve-fail) → GREEN (17/17 specs)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `frontend/src/components/workflows/soulData.ts` — the ONE shared module: `tierForDefinition`, `PHASE_GLYPHS`, `entryInputKeys`, `soulDeliverable`, `DefShape`, `SoulDeliverable`. Imports only `deriveTier` (no `@/lib/api`).
- `frontend/src/components/workflows/soulData.test.ts` — 14 specs: STRICT/MIDDLE/LOOSE tier fixtures, null-safe LOOSE default, glyph map exactness, needs fallback chain, deliverable file/chat resolution, no-api-import + single-export grep.
- `frontend/src/components/workflows/WorkflowSoul.tsx` — scale-keyed (`card`|`run`|`pub`) 5-atom soul; purpose HERO at every size; honest D-03 empty-states; authored strings as escaped React children (T-124-01).
- `frontend/src/components/workflows/WorkflowSoul.test.tsx` — 9 specs: all-5-atoms, tier-consistency invariant, both empty-states, glyph+WORD at every scale, file-deliverable label, null-safe, G-5 source-grep.
- `frontend/src/components/workflows/PhaseSpine.tsx` — horizontal glyph-dot row; glyph map imported from `soulData`; ribbons + indices stripped; `◆` emit tinted; name in `title=` (card) / visible (run+pub).
- `frontend/src/components/workflows/PhaseSpine.test.tsx` — 8 specs: dot-per-phase ordering, glyph render, ribbon-strip, index-strip, emit tint, title vs visible name, null-safe, G-5 source-grep.

## Decisions Made

- **A1 deliverable label is name-derived + honest, not hardcoded.** `soulDeliverable` returns `{ kind: "file", label }` where `label = "<workflow name> · file"` (or `"file deliverable"` when the name is missing). The emitter exposes no guaranteed static deliverable title/extension, so inventing "Status Report · .docx" would be a fabrication. **The exact friendly label string is flagged for manual UAT confirmation against sketch 046-A — not a hard assertion** (per A1). The honest `kind: "chat"` fallback is locked and asserted.
- **`PhaseSpine` accepts `def` (not a raw `phases[]`)** so the soul and the spine share the same loose `DefShape` read-shape and the same null-safety; the spine sorts by `phase_index` internally.
- Followed the plan's verbatim-extraction mandate: `tierForDefinition`/`PHASE_GLYPHS`/`entryInputKeys`/`DefShape`/`POLICY_ORDER`/`stricterPolicy`/`ALL_VALIDATOR_KINDS` were copied from `WorkflowsPage.tsx`, not re-implemented.

## Deviations from Plan

**1. [Rule 1 - Bug] G-5 source-grep tripped on PascalCase tokens in doc-comments**
- **Found during:** Task 2 (WorkflowSoul + PhaseSpine)
- **Issue:** The first draft of the `WorkflowSoul.tsx` / `PhaseSpine.tsx` JSDoc comments described the G-5 red line using the literal PascalCase tokens `PhaseTimeline` / `PhaseCard`. The `?raw` source-grep test (which greps the raw file text for `/PhaseTimeline/` and `/PhaseCard/`) matched those comment occurrences and failed — a false positive (no actual import existed). The `PhaseSpineGraph` precedent avoids this by writing the same red-line note in lowercase/hyphenated form ("phase timeline / phase-card").
- **Fix:** Rewrote the two doc-comments to "phase-timeline / phase-card" (lowercase/hyphenated), preserving the meaning. Both G-5 tests then passed.
- **Files modified:** `frontend/src/components/workflows/WorkflowSoul.tsx`, `frontend/src/components/workflows/PhaseSpine.tsx`
- **Verification:** `npx vitest run WorkflowSoul.test.tsx PhaseSpine.test.tsx` → 17/17 green.
- **Committed in:** `c5a6c610` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — test/source self-consistency)
**Impact on plan:** Necessary to make the G-5 backstop pass; no behavior or scope change. The grep correctly forbids real imports; the fix only removed a comment-text false positive.

## Issues Encountered

None beyond the deviation above. The `@` alias, jsdom env, and `?raw` loader all worked as in the `PhaseSpineGraph` precedent.

## Manual UAT Flag (A1)

The **deliverable-label string** rendered by `WorkflowSoul`'s output atom (currently `"<workflow name> · file"`) is **flagged for manual UAT confirmation against sketch 046-A** — it is intentionally NOT a hard test assertion. The mechanism (terminal `llm_emit` present → file; absent → honest "produces: answer in chat") is verified and locked; only the exact friendly label copy needs operator confirmation when the soul mounts in a host surface (Plans 02/03).

## Next Phase Readiness

- The shared `soulData` module + `WorkflowSoul` + `PhaseSpine` are ready for the host-surface mounts in Plans 02/03 (WorkflowsPage card re-skin, WorkspacePanel run-header sibling section, PublishGauntlet publish-summary soul block, WorkflowDoorSwitch govern door).
- `PhaseTimeline.tsx` / `PhaseCard.tsx` remain byte-identical (G-5 / D-07) — confirmed via empty `git diff --stat`.
- No blockers. STATE.md / ROADMAP.md intentionally NOT touched (orchestrator owns those writes after the wave).

## Self-Check: PASSED

- All 6 created files exist on disk (soulData.ts/.test.ts, WorkflowSoul.tsx/.test.tsx, PhaseSpine.tsx/.test.tsx) + the SUMMARY.
- All task commits present in git log: `0946bb54` (Task 1), `c5a6c610` (Task 2), `0bfaabb8` (docs).
- STATE.md / ROADMAP.md NOT touched by any of this plan's 3 commits and NOT staged (the unstaged STATE.md working-tree change pre-existed this plan — orchestrator owns those writes).
- `PhaseTimeline.tsx` / `PhaseCard.tsx` byte-identical (`git diff --stat` empty) — G-5 / D-07 held.

---
*Phase: 124-workflow-studio-ux-soul-strict-loose*
*Completed: 2026-06-26*
