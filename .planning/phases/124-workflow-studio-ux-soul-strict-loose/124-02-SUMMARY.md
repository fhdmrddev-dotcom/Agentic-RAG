---
phase: 124-workflow-studio-ux-soul-strict-loose
plan: 02
subsystem: ui
tags: [react, vitest, workflows, soul, two-doors, strict-loose, deriveTier, delegation, raw-source-grep]

# Dependency graph
requires:
  - phase: 124-01
    provides: "soulData.ts (DefShape + tierForDefinition + entryInputKeys + PHASE_GLYPHS + soulDeliverable), WorkflowSoul.tsx (scale-keyed 5-atom soul), PhaseSpine.tsx (glyph-dot spine)"
  - phase: 103-workflows-page-authoring
    provides: "WorkflowsPage host (PageView intra-view state, builder host block, RunModal), WorkflowBuilderPage (describe-first + drafted govern view + renderPublish/initial), PhaseSpineGraph ?raw G-5 idiom, deriveTier TIERS judgeAlwaysOn"
  - phase: 121-one-front-door
    provides: "the Phase-121 one-click library-card Run launch path (doRun → createThread → postMessage → create_workflow_run) preserved byte-identical (D-01)"
provides:
  - "Card-scale soul on every library card — DraftCard + PublishedCard render the shared <WorkflowSoul scale=\"card\"> (the same essence the run header + publish summary show)"
  - "WorkflowDoorSwitch.tsx — the explicit-fork two-door shell (047-A variant A): describe door (loose, soul preview + switch strip) + govern door (strict, delegates to the existing Builder)"
  - "WorkflowsPage builder host now mounts WorkflowDoorSwitch (fresh → 'both' chooser; Open/Tweak → govern door with the loaded def)"
affects: [124-03, WorkflowsPage card surface, Studio authoring entry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consume the Plan-01 shared soul: the page imports DefShape/entryInputKeys from soulData + renders <WorkflowSoul> — it no longer OWNS the tier/glyph/needs helpers (the single-source-of-truth invariant, SC#1+SC#2)"
    - "Explicit-fork disclosure shell (047-A variant A): a router-less local door state (both|describe|govern) wrapping the EXISTING Builder — governance delegated, never re-implemented"
    - "?raw delegation source-grep (mirrors PhaseSpineGraph.test.tsx:153-159): asserts the govern door IMPORTS + RENDERS WorkflowBuilderPage and contains NO inline citation_policy editor / deriveTier re-derivation / PhaseFormPanel clone"
    - "D-01 launch-not-wrapped: the library-card Run stays the Phase-121 path; a test asserts Run opens the run-modal + calls onLaunch and does NOT mount the door chooser"

key-files:
  created:
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  modified:
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "The describe-door CTA forwards the describe text via onDescribeDraft(describe) THEN advances to the govern door — the existing Builder owns the real generate→draft flow (the shell adds no new sink; D-01/T-124-08). The shell is a presentation fork only."
  - "Open/Tweak land in the govern door (initialDoor='govern' with the loaded `initial`); a fresh build opens at the 'both' chooser (initialDoor='both'). The page's builder-header label + back button stay above the shell unchanged."
  - "Doc-comment tokens citation_policy / deriveTier / PhaseFormPanel were reworded to hyphenated/space form (citation-policy / tier recompute / form panel) so the ?raw delegation source-grep does not false-positive — the SAME comment-text class the Plan-01 G-5 deviation hit."

requirements-completed: [WUX-01, WUX-02]

# Metrics
duration: ~8min
completed: 2026-06-26
---

# Phase 124 Plan 02: Card-Scale Soul + Strict↔Loose Two Doors Summary

**The library cards now render the shared `<WorkflowSoul scale="card">` (replacing the ad-hoc TierBadge + PhaseChain + "entry needs" trio), and the Studio authoring entry forks into the explicit two-door shell (047-A) — "Describe & run" (loose: describe box + soul preview + a one-click "switch to Author & govern ›" strip) and "Author & govern" (strict: the EXISTING Builder, delegated not cloned, with live tier recompute + a locked always-on judge) — while the library-card Run launch stays the Phase-121 one-click path, never wrapped by the fork (D-01).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-26T21:02Z
- **Completed:** 2026-06-26T21:10Z
- **Tasks:** 2 (both auto)
- **Files created:** 2 · **Files modified:** 2

## Accomplishments

- **Task 1 (WUX-01):** Replaced the page-local TierBadge + PhaseChain + "entry needs" span on both `DraftCard` and `PublishedCard` with a single `<WorkflowSoul def scale="card">`; deleted the now-duplicate `PHASE_GLYPHS` / `PHASE_TYPE_LABELS` / `tierForDefinition` / `entryInputKeys` / `DefShape` / `POLICY_ORDER` / `stricterPolicy` / `ALL_VALIDATOR_KINDS` definitions (the page imports them from `soulData` now) — the single-source-of-truth invariant. Card chrome (name/version header, folder chip, status pill, action buttons) is preserved; the `published-run` / `published-tweak` / `draft-open` / `draft-publish` / `draft-card` / `published-card` testids are intact.
- **Task 2 (WUX-02):** Built `WorkflowDoorSwitch` — the explicit-fork shell (door state `both | describe | govern`, default `both`). The `"both"` chooser renders two big door cards; the describe door reuses the 018-A describe-box shape/copy + a `<WorkflowSoul scale="card">` preview + the "switch to Author & govern ›" strip; the govern door mounts the EXISTING `WorkflowBuilderPage` (delegated). A persistent "‹ both doors" returns from either open door. Wired it into the `WorkflowsPage` builder host — fresh build → `"both"`, Open/Tweak → `"govern"` with the loaded `initial`.
- **D-01 held:** The library-card Run path (`doRun → createThread → postMessage → create_workflow_run`, surfaced via the page's RunModal + `onLaunch`) is NOT routed through the shell — a test asserts Run opens the run-modal + calls `onLaunch` and does NOT mount the door chooser.
- **G-5 hot files untouched:** `PhaseTimeline.tsx` / `PhaseCard.tsx` / `ChatLayout.tsx doRun` carry zero diff (`git diff --stat` empty).

## Task Commits

1. **Task 1: Card-scale WorkflowSoul on library cards (WUX-01)** — `15a59f52` (feat) — 20/20 WorkflowsPage specs green.
2. **Task 2: Two-door fork at the Studio authoring entry (WUX-02, 047-A)** — `0cbcadf3` (feat) — 10/10 WorkflowDoorSwitch specs + 20/20 WorkflowsPage specs green.

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (NEW) — the explicit-fork two-door shell. Local door state; the describe door (textarea labelled "business requirement" + draft CTA + honest hint + switch-strip + soul preview); the govern door (delegates to `WorkflowBuilderPage` + a locked `judge-locked` affordance). Imports NOTHING from `@/lib/api`; no local tier re-derivation. All authored strings render as escaped React children (T-124-05).
- `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` (NEW) — 10 specs: both door cards at `"both"`; describe-door switch-strip + soul preview + `‹ both doors` return; switch-strip → govern; the describe CTA forwards text then opens govern; the govern door mounts the Builder; `llm_judge_rubric` LOCKED (no checkbox / not role=switch); the `?raw` delegation source-grep (imports + renders `WorkflowBuilderPage`, no inline governance clone); no-api-import + no-deriveTier grep.
- `frontend/src/pages/WorkflowsPage.tsx` (MOD) — imports the soul atoms from `soulData`; card bodies render `<WorkflowSoul scale="card">`; the builder host mounts `<WorkflowDoorSwitch>` (with `def` / `initialDoor` / `initial` / `renderPublish`) instead of `WorkflowBuilderPage` directly. `TierBadge`/`PhaseChain` and the duplicate helpers deleted (−177 net lines on Task 1).
- `frontend/src/pages/WorkflowsPage.test.tsx` (MOD) — the old `tier-badge` tier tests retargeted to the soul's `soul-tier`/`soul-spine`/`workflow-soul` testids; a new D-01 launch-not-wrapped test added; the three fresh-build tests retargeted from `describe-hint` to the `workflow-doors` chooser.

## Decisions Made

- **The describe-door CTA delegates to the Builder's generate path.** The shell's `onDescribeDraft(describe)` forwards the describe text to the existing draft/generate path, then `setDoor("govern")` mounts the Builder (which owns the real generate→draft flow). The shell never calls the API itself (D-01/T-124-08) — it is a presentation fork over governance the Builder owns.
- **Open/Tweak land in the govern door.** The page passes `initialDoor={builderInitial ? "govern" : "both"}` so Open a draft / Tweak a published workflow land straight in the govern Builder with the loaded `initial`; a fresh build opens the chooser. The Open/Tweak spine-node + "Tweak · vendor-risk v3" header tests still pass (the header is the page's builder label above the shell).
- **Judge-locked rendered as an affordance, not a re-modelled toggle.** The govern door surfaces a `judge-locked` badge ("🔒 judge always-on") whose title cites the `TIERS.judgeAlwaysOn` + gauntlet hard-wall invariant; the actual judge enforcement stays delegated to the Builder/gauntlet (the shell never re-models the gate).

## Deviations from Plan

**1. [Rule 1 - Bug] ?raw delegation source-grep would false-positive on PascalCase/underscore doc-comment tokens**
- **Found during:** Task 2 (WorkflowDoorSwitch + its delegation source-grep)
- **Issue:** The first draft of `WorkflowDoorSwitch.tsx`'s JSDoc + an inline comment described the delegated governance using the literal tokens `citation_policy`, `deriveTier`, and `PhaseFormPanel`. The `?raw` delegation source-grep (which asserts the source does NOT contain its own `citation_policy` editor / `deriveTier` re-derivation / `PhaseFormPanel` clone) would have matched those comment occurrences — a false positive (no actual inline governance clone exists). This is the EXACT class of bug the Plan-01 G-5 deviation hit (PascalCase tokens in doc-comments).
- **Fix:** Reworded the two comments to hyphenated/space form ("citation-policy picker", "tier recompute", "form panel"), preserving the meaning. The forbidden literal tokens (`citation_policy` / `deriveTier` / `PhaseFormPanel`) now appear nowhere in the source; the delegation grep passes.
- **Files modified:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx`
- **Verification:** `grep -nE 'citation_policy|deriveTier|tierForDefinition|PhaseFormPanel' WorkflowDoorSwitch.tsx` → no matches; `npx vitest run WorkflowDoorSwitch.test.tsx` → 10/10 green.
- **Committed in:** `0cbcadf3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — test/source self-consistency, identical class to the Plan-01 precedent). No behavior or scope change — the grep correctly forbids real inline governance clones; the fix only removed comment-text false positives.

## Authentication Gates

None.

## Threat Surface Scan

No new endpoint, fetch path, auth route, or schema surface. The shell reads only the same owner-scoped definition the card already gets (`PublishedWorkflow.definition`); the describe box reuses the existing draft/generate path (no new sink); all authored strings render as escaped React children (T-124-05); the library-card Run path is preserved byte-identical and asserted (T-124-06); the govern door delegates governance to the Builder + renders the judge locked (T-124-07). All four register dispositions are honoured — nothing beyond the plan's `<threat_model>`.

## Known Stubs

None. The describe-door soul preview renders real `<WorkflowSoul>` over the live `def`; the govern door mounts the real Builder; no hardcoded empty/mock data flows to the UI.

## Verification

- `cd frontend && npx vitest run src/pages/WorkflowsPage.test.tsx src/components/workflows/WorkflowDoorSwitch.test.tsx` → **30/30 green**.
- `cd frontend && npx vitest run src/components/workflows src/pages` → **159/159 green** (13 files, no regression).
- `npx tsc --noEmit` → **0 errors**.
- The D-01 launch-not-wrapped test, the govern-door `?raw` delegation source-grep, and the judge-locked test are all present and green.
- G-5 hot files (`PhaseTimeline.tsx` / `PhaseCard.tsx` / `ChatLayout.tsx doRun`) — `git diff --stat HEAD` empty.
- Manual sketch-match (card soul vs 046-A · both doors vs 047-A) deferred to the phase-gate UAT (Plan 03 owns the run/pub UAT rows), per the plan's verification note.

## Next Phase Readiness

- The card-scale soul + the two-door entry are live for Plan 03 (which owns the run-header soul section + the publish-summary soul block + the SC#10 4-axis run/pub UAT rows).
- The exact card-soul deliverable-label copy + the door framing remain flagged for operator sketch-match confirmation at the phase-gate UAT (A1 carry-forward from Plan 01).
- No blockers. STATE.md / ROADMAP.md intentionally NOT touched (orchestrator owns those writes after the wave).
