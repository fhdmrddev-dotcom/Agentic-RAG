---
phase: 290-the-card-and-the-team-picture
verified: 2026-10-22T00:00:00Z
status: passed
score: 4/4 roadmap SCs verified in code (SC#1 screenshot half owed to human)
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "SC#1 screenshot of the library card against .planning/sketches/290-card-chip-line/ (winner B)"
    expected: "Bordered pills with glyph + type sentence, arrows, first 3 + '+N more' that expands in place; card does not lead with a paragraph"
    why_human: "Visual comparison to an approved sketch"
  - test: "G-4 Chrome rows S1-S5 from 290-VALIDATION.md (incl. real 7-phase workflow, WR-03/WR-04 line geometry)"
    expected: "No line appears between two steps unless it is a jump; gate lines do not read as links between gates"
    why_human: "Rendered geometry/lived experience; WR-03/WR-04 were fixed but flagged visual"
  - test: "WR-02 decision (operator)"
    expected: "Either lift view into builder and gate undo/redo + side panel in Team, or change header so it does not say 'View only'"
    why_human: "Design choice; touches UI-SPEC locked header line"
---

# Phase 290 Verification

**Goal:** library card matches approved sketch (labelled chips, description not dominant); multi-agent workflow viewable as a truthful team picture.
**Status:** human_needed. No code gap against the four roadmap success criteria.

## Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | Card shows labelled chips; description does not dominate (VIS-04) | VERIFIED in code / screenshot owed | `stepLine.ts` maps each step through `own(PHASE_TYPE_SENTENCES, type)` (words, never type ids; unknown type echoes raw, untyped reads `STEP_LINE_UNTYPED`); first 3 + `more`. `WorkflowCard.tsx` diff is +7 lines: one `resolveStepLine(row.def)` and `{stepLine && <StepChipLine/>}`. `WorkflowCard.test.tsx:827` pins the sentence "Work out how to do it"; `:734` asserts the card does NOT contain the business requirement text; `StepChipLine.test.tsx:94` asserts `+N more` text. Description is off the resting card (179 C, D-02) so "no longer dominates" holds by the shipped card. |
| SC#2 | Multi-agent workflow openable as orchestrator/workers/judge from the definition (VIS-01) | VERIFIED | `teamModel.ts` `deriveTeam` derives steps, seats, gates (Check/Judge), lines from phases; `TeamPicture.tsx` renders it; `WorkflowCanvas.tsx` mounts it behind a `team` prop and `TeamViewSwitch`; builder passes `team=` at `WorkflowBuilderPage.tsx:2080`. |
| SC#3 | No edge the schema lacks (planted workflow with no worker-to-worker link draws none) | VERIFIED | Only line kinds are handoff/gate/jump; jump emitted only when `parseSkipTarget` slug resolves (`teamModel.ts` ~409-425); every line carries a `source` path. Plan truth 1 pins zero step-to-step lines except jump across all fixtures. `TeamPicture.test.tsx:99-135` asserts rendered `data-line-kind` counts (no jump unless one resolvable). |
| SC#4 | Single-agent shows honest one-node picture, never an invented worker | VERIFIED | `oneStep` flag with exactly one handoff and no invented step; `TeamPicture.tsx:490,519` render the one-step wording; 0 steps gives absence 'empty'. |

Failure signals checked: card leading with a paragraph (no); chips as type ids (no); invented arrows (no); breaks on 7-phase workflow (a 7-step stress fixture exists and CR-01 was found with it and fixed in `ed6803cb5`); second runtime/canvas (no: read-only, derives from in-memory phases, no backend or migration change; scope-fence diff empty per 290-04-GATES).

## Behavioral spot-checks
`npx vitest run` on teamModel, teamVocabulary, TeamPicture, WorkflowCanvas.team, library/, headerPin: 22 files, 1095 tests passed, 0 failed. Vitest rewrote two 290 `.snap` files with EOL-only changes; I restored them with `git restore`. The two `*.seam286.pin` page snaps were already modified before this run and I left them alone.

## Requirements
| ID | Status | Evidence |
|---|---|---|
| VIS-04 | SATISFIED (code); screenshot owed | SC#1 |
| VIS-01 | SATISFIED | SC#2-4 |
Both map to Phase 290 in REQUIREMENTS.md (still `Pending` checkboxes, to be flipped by orchestrator at close). No orphaned IDs.

## WR-02 decision (explicit)
WR-02 does NOT make a must_have or roadmap success criterion unmet. SC#1-4 and the plan truths concern what the picture shows and draws; none claims undo/redo or the side editor are disabled in Team view. It is a UX honesty defect: the header says "View only" while undo/redo and the open PhaseFormPanel can still change the definition (the picture re-derives, so it never lies about the definition, only about editability). It stays deferred with re-open trigger "next phase listing WorkflowCanvas.tsx in files_modified". The only requirement-adjacent risk is the failure signal "view becomes a second canvas", which it does not trip (no new edit surface was added). Under G-7 it is not a ground for a gap round. It is listed as a human decision.

## Anti-patterns
No TBD/FIXME/XXX/TODO in the 290 source files. Open review items IN-01..IN-05 are informational. Known follow-up: `canvasModel.ts` armed detour has the CR-01 gap on the Steps canvas (pre-existing, out of scope).

## Gaps
None blocking. Items for human: SC#1 screenshot, G-4 rows S1-S5 (not run by me), WR-02 choice.

## Re-verification (2026-10-24)

The owed G-4 rows were driven in Chrome by Claude (290-VALIDATION.md, all PASS except the read-only starter, not reachable) and signed by the operator; WR-02 accepted as known (a). **Status: passed.**
