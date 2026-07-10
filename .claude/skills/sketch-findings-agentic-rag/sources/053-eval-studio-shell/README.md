---
sketch: 053
name: eval-studio-shell
question: "Where does the Skill Evals panel LIVE — focused full-surface, in-panel accordion, or expand-to-wide panel — given five subsurfaces and a side-by-side run detail that needs width?"
winner: "A"
tags: [phase-137, panel-01, shell, ia, skills-page, full-surface, accordion, push-split]
---

# Sketch 053: Eval Studio Shell

## Design Question

PANEL-01 must house five subsurfaces (test-case editor · run history · run detail with
per-case side-by-side outputs · inline ratings · version history with diffs) — plus the
136 publish-gate status and the 135 proposal card. Today ALL of it is stacked inside the
skill EDIT dialog in the ~384px detail panel, which produced the operator's "messy UI,
too much information" verdict. Where does the designed panel live?

**The structural tension:** the side-by-side WITH/WITHOUT comparison (PANEL-01's own
words) fundamentally needs width the 384px panel doesn't have. The Trigger Tuner already
hit this exact wall and won as a focused full-surface (041-A); sketch 045 then re-learned
the density lesson the hard way. But PANEL-01 also says "additive — no Skills-tab
redesign."

## How to View

open .planning/sketches/053-eval-studio-shell/index.html

## Variants

- **A: Focused full-surface** — the panel keeps the edit form + ONE summary line; "Open
  evals" swaps the whole working area for a dedicated studio (`‹ Skills` returns), exactly
  the 041-A Tuner move (`ActiveView` switch precedent already shipped as `SkillTunerPage`).
  Two-column studio: cases + versions left, runs + side-by-side detail main.
- **B: In-panel stacked accordion** — everything stays in 384px, reorganized: edit form
  collapses to a section (no longer dominates), Status/Cases/Runs/Versions accordion
  (004-B/027-A), run detail = full-replace drill-in (005-A) with STACKED arms.
- **C: Expand-to-wide panel** — panel keeps a compact summary; "Open evals ⤢" widens the
  panel to ~85% while the skill list collapses to an icon rail (032-A Documents
  precedent). Same two-column studio as A, but as a panel STATE, not a separate surface.

## What to Look For

- **The side-by-side moment** (open a run): A and C give the comparison two honest
  columns; B stacks them. Is a stacked WITH/WITHOUT still a comparison, or does it
  destroy the point?
- **Navigation honesty:** A leaves the Skills page (breadcrumb back); C stays "on" the
  page but visually replaces it anyway. Which mental model matches "additive, no
  Skills-tab redesign"?
- **The panel at rest:** in A and C the panel drops to form + one gate line — is that
  calm enough to close the "messy UI" complaint on its own?
- **Build cost:** A rides the shipped SkillTunerPage `ActiveView` pattern (least net-new);
  C needs the width-transition machinery; B needs the least layout but sacrifices the
  comparison.

## Build Handover (reuse vs net-new)

- **Reuse:** `SkillTunerPage` ActiveView/no-router switch (A); workspace-panel accordion
  anatomy (B); `useResizablePanel` + 032-A rail-collapse pattern (C); 048 provider logo
  map for run rows; `SkillTestCasesSection` CRUD handlers; `SkillEvalSection` run/SSE
  handlers (lift state, re-skin render).
- **Net-new:** the studio layout component; the panel "summary" compact state; run-row
  list anatomy (055 details it); version-row anatomy (056 details it).
