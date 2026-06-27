---
phase: 127-gauntlet-pip-strip-quiet-idle-cards
plan: 03
subsystem: frontend/workflow-run-surface
tags: [WUX-03, phasecard, phasetimeline, density-by-status, energy-reskin, a11y, g-5]
requires:
  - "frontend/src/lib/phaseGlyph.tsx (Plan 127-01 — the 3D phase-type resolver)"
  - "frontend/src/lib/providerLogo.tsx (Phase 128 — the provider→@lobehub mark seam)"
provides:
  - "PhaseCard density-by-status re-skin: quiet idle / bloom active / fold done / failed-unchanged"
  - "Running-only honest activity line + engine chip (real provider only, honestly-absent otherwise)"
  - "Shared 3D phase-type glyph via phaseGlyph() with the unicode '•' fallback"
  - "PhaseTimeline decorative, reduced-motion-gated energy-connector spine (semantics byte-unchanged)"
affects:
  - "The live harness/workflow run surface (PhaseCard/PhaseTimeline are the live-run cards)"
tech-stack:
  added: []
  patterns:
    - "Tailwind motion-safe: variant for reduced-motion-gated motion (no index.css edits)"
    - "Density branched on phase.status in the existing cn() — no data-model change"
    - "Engine chip mirrors RunCard's providerLogo() consumer (null → no chip on the live card)"
key-files:
  created: []
  modified:
    - "frontend/src/components/panel/PhaseCard.tsx"
    - "frontend/src/components/panel/PhaseTimeline.tsx"
    - "frontend/src/components/panel/PhaseCard.test.tsx"
decisions:
  - "Activity line is honestly minimal: a motion-safe pulse dot + 'Working' + the real engine chip. No fabricated count (the sketch's '14 agents' is exactly the warned-against fabrication); the engine chip is honestly-absent when phase.subAgents has no provider (it is [] for nearly every phase today)."
  - "The energy comet lives on PhaseTimeline's rail (where the nodes/rail are), not inside PhaseCard; PhaseCard's 'alive' is the amber bloom + glow + the running-only activity-line pulse + the existing progressbar. No new index.css keyframes (index.css is not in this plan's files_modified) — the motion-safe:animate-pulse Tailwind utility carries the reduced-motion contract."
  - "The llm_batch_agents accent-violet left border is kept but gated to non-running/non-failed states so the running BLOOM owns the amber left bar while live (the violet bar is not removed — it returns once the phase leaves running)."
metrics:
  duration: ~9 min
  completed: 2026-06-27
  tasks: 2
  files: 3
---

# Phase 127 Plan 03: Quiet-Idle / Alive-Active Live Step-Flow Re-skin Summary

Re-skinned the live phase spine (`PhaseCard.tsx` / `PhaseTimeline.tsx`, winner 052-A) for "calm at rest, comprehensive on the active step" — idle steps go quiet/still, the active step blooms with a running-only activity line + honest engine chip, done folds to a one-line essence, and failed renders the closed-taxonomy reason unchanged — all as a VISUAL-ONLY change that left the status/data model and every G-5 a11y/honesty contract byte-behavior-unchanged.

## What was built

**Task 1 — `PhaseCard.tsx` density-by-status re-skin (commit `6eb2c408`):**
- Extended the root `cn()` status branch: `pending` → dim/quiet (`opacity-60`, no motion), `running` → BLOOM (amber wash gradient + glowing `border-l-[3px]` bar + soft glow shadow), `done`/`skipped` → folded calm, `failed`/`retrying` tints unchanged.
- Made the type `oneLiner` ACTIVE-step only (`isActive = running || retrying`) — gone from idle and done (SC#2 / RESEARCH Pitfall 4). It is a different string from the activity line.
- Added the RUNNING-ONLY activity line (`data-activity-line`): a `motion-safe:animate-pulse` dot + an honest "Working" label + the engine chip. The chip renders ONLY from a real `phase.subAgents[0].provider` via `providerLogo()` (honestly-absent otherwise — no `Bot` fabrication on the live card, T-127-08). No fabricated count.
- Swapped the phase-type glyph to the shared 3D `phaseGlyph(phase.phaseType)` with the existing unicode `•`/type fallback when it returns null; the glyph wrapper stays `aria-hidden="true"`.
- Untouched: `STATUS_META`, `SUBSTEP_META`, `classifyFailure`, the APG accordion (`<h3>`/`<button aria-expanded/aria-controls/aria-disabled>`, `role="region"`/`hidden`/`aria-busy`), the indeterminate `role="progressbar"`, the `role="alert"` failure block + `reason_unknown` sentinel, and the `data-emit-substep` sub-row.

**Task 2 — `PhaseTimeline.tsx` energy spine + extended tests (commit `3f6653aa`):**
- Added a DECORATIVE vertical energy-connector spine in a `relative` wrapper around the `<ol>`: `aria-hidden` + `pointer-events-none` + no focusable element, with a reduced-motion-gated (`motion-safe:`) comet that animates only while `isBusy`. The `<ol>`/`<li>`/`<PhaseCard>` structure, `aria-label="Phases"`, `aria-busy`, the `role="status"` announcer, the forward-only "Phase i / N" counter, the agent tally, and the reconcile-frame fetch are all byte-unchanged.
- Extended `PhaseCard.test.tsx` (existing assertions untouched) with: idle-quiet (no oneLiner / no activity line / no `animate-*`), active-bloom (activity line + oneLiner present), engine-chip-present-with-provider / absent-without (`anthropic` sub-agent → an SVG mark in the activity line; `subAgents: []` → no SVG), done-fold, and the 3D-glyph-known / unicode-fallback-unknown contracts.

## Verification

- `npx vitest run src/components/panel/PhaseCard.test.tsx src/components/panel/__tests__/PhaseTimeline.test.tsx src/components/panel/__tests__/FailReason.test.tsx` → **34/34 passed** (the existing GAP-C/failure/XSS/replay-axe assertions all green UNCHANGED — the structural visual-only proof — plus the 5 new density assertions).
- `npx tsc --noEmit -p tsconfig.app.json` → no type errors in the touched files.
- Grep guards on both source files: NO `dangerouslySetInnerHTML`, NO `soul` prop threaded (soul stays an additive sibling — G-5 red line), NO `iconify-icon`/CDN.

The per-wave full-suite merge gate (`cd frontend && npm test`) and the manual SC#2 / cross-provider engine-chip / 4-axis UAT (authored in 127-VALIDATION.md) are the orchestrator/operator's gate after the wave merges.

## Deviations from Plan

None — plan executed as written. Task 1 is marked `tdd="true"`; the new density assertions are authored in Task 2 per the plan's explicit task split, so Task 1 was guarded by the existing PhaseCard regression suite staying green (the stated visual-only proof) rather than a separate RED commit.

## Notes for the orchestrator

- A `node_modules` Windows junction was created at `frontend/node_modules` (→ main checkout) to run vitest in the worktree, then removed before return. It is gitignored and never staged.

## Self-Check: PASSED
- FOUND: frontend/src/components/panel/PhaseCard.tsx (committed `6eb2c408`)
- FOUND: frontend/src/components/panel/PhaseTimeline.tsx (committed `3f6653aa`)
- FOUND: frontend/src/components/panel/PhaseCard.test.tsx (committed `3f6653aa`)
- FOUND: commit `6eb2c408` (Task 1), commit `3f6653aa` (Task 2)
