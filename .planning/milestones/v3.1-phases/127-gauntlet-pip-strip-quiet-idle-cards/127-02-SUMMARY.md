---
phase: 127-gauntlet-pip-strip-quiet-idle-cards
plan: 02
subsystem: ui
tags: [react, tailwind, workflow-studio, publish-gauntlet, unplugin-icons, fluent-emoji, providerLogo, lobehub-icons, vitest]

# Dependency graph
requires:
  - phase: 127-01
    provides: the phaseGlyph resolver + the `~icons/*` unplugin-icons build-time bundling discipline + the verified-slug icon convention this plan mirrors for the gauntlet stage glyphs
  - phase: 124
    provides: the shipped `<WorkflowSoul scale="pub">` block this re-skin rides UNDER (untouched)
  - phase: 128
    provides: the shared `providerLogo()` → `@lobehub/icons` seam reused for the honest engine chip
provides:
  - "PublishGauntlet energy-spine: 8 wrapping boxes → a compact horizontal spine of 3D fluent-emoji icon nodes joined by energy connectors (passed=green+✓, golden-run=amber aura+comet, blocked=red), server-truth-driven"
  - "Worded verdict leads the resolved block (verdict-headline testid); the verbatim 5-field PublishVerdict grid + the ▦ provenance cap demoted behind <details data-testid=raw-verdict>"
  - "Golden-run hero: breathing amber glow + rocket aura node + live elapsed clock; honest engine chip (providerLogo()→Bot, omitted when no real provider)"
  - "5 extended honesty/visual assertions in PublishGauntlet.test.tsx; all 19 prior contracts unchanged (24/24 green)"
affects: [workflow-studio, publish-gauntlet, icon-convention, WUX-03, 127-verification, 127-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage-glyph map embedded in the STAGES array (Icon field) for guaranteed 1:1 label↔glyph alignment, mirroring the providerLogo MARKS-map shape"
    - "All gauntlet motion (comet/aura/hero-glow/caret) lives in index.css alongside the existing @keyframes, every animation gated behind prefers-reduced-motion (colour+glyph+✓ carry state without motion)"
    - "Lead-with-words verdict: a server-truth-DERIVED headline + the verbatim grid demoted behind a <details> disclosure (honesty preserved, not leading)"

key-files:
  created: []
  modified:
    - "frontend/src/components/workflows/PublishGauntlet.tsx — energy-spine + golden-run hero + engine chip + worded verdict + raw-on-demand <details>"
    - "frontend/src/components/workflows/PublishGauntlet.test.tsx — 5 new assertions (worded-leads/DOM-order, grid-in-details, cap-in-details, criteria-first-class, success-worded)"
    - "frontend/src/index.css — gauntlet energy keyframes (aura/comet/hero-glow) + .rawbox caret, all reduced-motion-gated"

key-decisions:
  - "Engine chip resolution inlined at PublishingNotice top (const EngineMark = providerLogo(provider)) rather than a separate EngineChip component — the small-component form tripped a react-hooks/static-components false positive; the inline form mirrors RunCard.tsx:256/311 (the canonical consumer the rule does not flag)"
  - "Gauntlet animation CSS placed in index.css (the established home for every @keyframes in the app) rather than the two declared files — keeps motion reduced-motion-gated in one place"
  - "Engine chip is honestly-absent on the publish surface: PublishVerdict carries no provider, so no chip renders (never a fabricated engine, T-127-06); the providerLogo()→Bot path is wired and ready for a future provider-bearing surface"

patterns-established:
  - "Verify-or-bundle icon discipline (icon-convention §3): all 8 stage slugs API-verified present before import; unplugin-icons fails the build on a missing slug, so no production icon can render empty"
  - "Demote-behind-disclosure for debugger-grade detail: keep the whole verbatim component (VerdictFields) inside <details> so its provenance cap travels with it — never split the cap out"

requirements-completed: [WUX-03]

# Metrics
duration: 16min
completed: 2026-06-27
---

# Phase 127 Plan 02: Energized Publish Gauntlet (pip-strip + worded verdict) Summary

**Re-skinned `PublishGauntlet.tsx` into an alive energy-spine (3D icon nodes + amber golden-run comet/aura hero) that LEADS with a plain-worded verdict and demotes the verbatim 5-field grid behind a `<details>` — every honesty contract (verbatim verdict, judge hard-wall, 4 HTTP outcomes, run-link gating, criteria-first-on-block) preserved byte-for-behavior; 24/24 tests green.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-27T16:58:11Z
- **Completed:** 2026-06-27T17:14:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- **Task 1 — energy-spine + golden-run hero + engine chips:** the 8 wrapping `<div className="rounded border">` boxes became a compact horizontal spine of 3D fluent-emoji icon nodes joined by energy connectors. Passed nodes glow green with a ✓ badge, the running golden-run node (i===5) pulses an amber aura with an energy comet flowing into it, a blocked node turns red. The `blockedIndex` / `isPassed` / `running && i===5` derivation is byte-unchanged (visual tone only — `verdict.blocked_stage` still drives the highlight). `PublishingNotice` became the hero: a breathing amber glow + a rocket aura node + the unchanged live mm/ss `publish-elapsed` clock. An honest engine chip (`providerLogo()`→`Bot`) is wired but omitted on this surface (no provider in the verdict).
- **Task 2 — worded verdict leads + raw-on-demand + tests:** the resolved block now leads with a plain-worded headline derived from server truth (🎉 Published — v{n} is live / ⚖️ Blocked by the grader / ⛔ Blocked early — {stage}); the verbatim 5-field grid + the `▦ rendered verbatim` provenance cap are demoted inside `<details data-testid="raw-verdict">` (rotating-caret `.rawbox`); the judge per-criterion rows + RunLink + HardWall stay first-class. Added 5 assertions.
- All motion (comet/aura/hero-glow/disclosure caret) gated behind `prefers-reduced-motion`; all 8 stage slugs API-verified and bundled via unplugin-icons (no `iconify-icon`/CDN, no `direct-hit`/`no-entry-sign` empty traps).

## Task Commits

Each task was committed atomically:

1. **Task 1: Energy-spine + golden-run hero + engine chips** — `9a2fbbaf` (feat)
2. **Task 2: Worded verdict leads + raw grid behind `<details>` + test extension** — `5d2638af` (feat)

## Files Created/Modified
- `frontend/src/components/workflows/PublishGauntlet.tsx` — the energized re-skin: `GauntletSpine` (icon-node energy spine), `PublishingNotice` (golden-run hero + engine chip), the worded `verdict-headline`, and the `raw-verdict` `<details>` wrapping the unchanged `VerdictFields`.
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — 5 extended assertions (worded-leads + DOM-order, grid-in-details with all 5 verdict-* rows, cap-in-details, criteria-first-class, success-worded). No existing assertion modified.
- `frontend/src/index.css` — `gauntletAura` / `gauntletComet` / `gauntletHeroGlow` keyframes + `.gauntlet-node-run` / `.gauntlet-comet` / `.gauntlet-hero-glow` / `.rawbox` classes, all reduced-motion-gated.

## Decisions Made
- **Engine chip inlined, not a sub-component:** a tiny `EngineChip` wrapper tripped `react-hooks/static-components` (a false positive — `providerLogo` returns a stable module-level mark, not a per-render component). Inlining `const EngineMark = providerLogo(provider)` at `PublishingNotice`'s top mirrors `RunCard.tsx:256/311` (the canonical consumer the rule does not flag), with one scoped `eslint-disable-next-line` on the JSX usage carrying a justification.
- **Animation CSS in index.css:** placed alongside the app's other `@keyframes` (`fileFlash`, `brandPulse`, …) so all reduced-motion gating is consistent and in one home. (Minor scope addition beyond the two declared files — see Deviations.)
- **Engine chip honestly absent:** `PublishVerdict` carries no provider, so the publish surface renders no chip (never a guessed engine, T-127-06); the `providerLogo()`→`Bot` path is wired and ready for a provider-bearing surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supporting CSS added to `index.css` (outside the declared two files)**
- **Found during:** Task 1 (energy-spine + hero)
- **Issue:** The energy comet / aura / hero-glow / disclosure-caret animations require `@keyframes` + reduced-motion-gated classes; Tailwind has no built-in keyframes for these, and the app's established home for every `@keyframes` is `index.css`.
- **Fix:** Added the four keyframes + their classes to `index.css`, each gated behind `@media (prefers-reduced-motion: reduce)`. No existing CSS changed.
- **Files modified:** `frontend/src/index.css`
- **Verification:** `npx vitest run` (24/24) + `npx eslint` (clean); visual classes referenced by the component.
- **Committed in:** `9a2fbbaf` (Task 1 commit)

**2. [Rule 1 - Bug] `react-hooks/static-components` false positive on the engine-chip mark**
- **Found during:** Task 2 (lint pass)
- **Issue:** The capitalized `EngineMark` resolved from `providerLogo()` and rendered as `<EngineMark/>` tripped the rule, which the byte-identical `RunCard` pattern does not (flow-sensitive heuristic; the mark is a stable module-level reference, not a per-render component).
- **Fix:** Inlined the resolution at `PublishingNotice`'s top (mirroring `RunCard`) + one scoped `eslint-disable-next-line react-hooks/static-components` on the JSX usage with a justification comment.
- **Files modified:** `frontend/src/components/workflows/PublishGauntlet.tsx`
- **Verification:** `npx eslint … PublishGauntlet.tsx PublishGauntlet.test.tsx` → exit 0; 24/24 tests still green.
- **Committed in:** `5d2638af` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were required to ship the presentation re-skin cleanly (animation home + lint compliance). No scope creep — no behavior changed, no honesty contract softened.

## Issues Encountered
- **Worktree had no `node_modules` and no `.env.local`** (both gitignored), so vitest could not run there. Resolved via a Windows directory junction `frontend/node_modules` → the main repo's `node_modules` and a copy of the gitignored `frontend/.env.local` (supplies `VITE_SUPABASE_URL` the test's `importOriginal` of `@/lib/api` needs). Both are gitignored — neither is committed. This is test-infra setup, not a code change.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — no stub/placeholder data introduced. The engine chip's honest absence on the publish surface is by design (T-127-06: no provider in `PublishVerdict`), not a stub.

## Self-Check: PASSED
- `frontend/src/components/workflows/PublishGauntlet.tsx` — FOUND (modified, committed `9a2fbbaf` + `5d2638af`)
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — FOUND (modified, committed `5d2638af`)
- `frontend/src/index.css` — FOUND (modified, committed `9a2fbbaf`)
- Commit `9a2fbbaf` — FOUND in git log
- Commit `5d2638af` — FOUND in git log
- `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` — 24/24 passed
- `npx eslint` on both modified component files — exit 0

## Next Phase Readiness
- WUX-03 gauntlet half (sketch 051-A) is complete; the live step-flow half (sketch 052-A, `PhaseCard`/`PhaseTimeline`) is the sibling wave of Phase 127.
- Manual UAT is authored in `127-VALIDATION.md` (resolved-states walkthrough + 4-HTTP-outcomes-distinct + cross-provider engine-chip logo check) — not duplicated here.
- Per-wave merge gate (`cd frontend && npm test`, full suite) is the orchestrator's responsibility post-merge; known pre-existing rot (SEED-056) is unrelated to this surface.

---
*Phase: 127-gauntlet-pip-strip-quiet-idle-cards*
*Completed: 2026-06-27*
