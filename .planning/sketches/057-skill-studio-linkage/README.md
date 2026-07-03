---
sketch: 057
name: skill-studio-linkage
question: "With Tuner ⟷ Evals LOCKED as tabs of one unified Skill Studio (operator 2026-07-03), how do the tabs compose — and what is the complete every-button→destination navigation contract for the Skills surface?"
winner: null
tags: [phase-137, panel-01, skill-studio, tabs, ia, nav-map, linkage, tuner-absorption, reference]
---

# Sketch 057: Skill Studio Tabs & the Every-Button Linkage Map

## Design Question

The operator locked the co-location decision: the shipped Trigger Tuner (041/042/043/045)
and the new Evals surface become **tabs of ONE unified Skill Studio** — a focused
full-surface in the 041-A form. Two questions remain, and this sketch answers both:

1. **Tab composition** — which tabs, what lands first, where does the gate status live?
2. **The navigation contract** (the gap the operator caught): every button on the Skills
   surface → its declared destination, 023-style, including the PublishGateDialog seam
   and the SkillTunerPage absorption.

## How to View

open .planning/sketches/057-skill-studio-linkage/index.html

## Variants

- **A: Persistent status header + 3 tabs** — Evals · Triggering · Versions under a
  header that carries the skill identity + the 054 gate strip on every tab. Landing =
  Evals. Leanest.
- **B: Overview landing tab** — Overview · Evals · Triggering · Versions; you land on a
  status-hero dashboard whose stat tiles double as jump-links. More welcoming cold;
  one extra hop when you came to work.
- **C: Two tabs, versions inside Evals** — Evals · Triggering only; version history is
  the Evals tab's left rail (versions and evals are one story). Fewest tabs; versions
  lose their direct entry point.
- **MAP (reference, not a competing design)** — the complete button→destination table +
  geography diagram + migration notes. Whatever A/B/C wins, the MAP is the build
  contract, adjusted only for which tab names exist.

## What to Look For

- **A vs B:** is the persistent gate strip (A) worth more than a dashboard landing (B)?
  You'll open this surface most often to run/read an eval — count the clicks.
- **C's fold:** does versions-as-rail feel tighter or buried? (056's diff needs room —
  check it would fit in C's rail column or force a drill-in.)
- **The MAP tab** — verify every button you know exists is in the table, especially:
  the lint "Tune this →" RE-POINT (today it opens the standalone Tuner page), the
  PublishGateDialog "Review evals →" net-new link (closes the "gate only discoverable
  in the dialog" complaint), and the SkillTunerPage ABSORBED row.

## Build Handover (reuse vs net-new)

- **Reuse:** `SkillTunerPage` internals mount unmodified inside the Triggering tab (a
  re-homing, not a rebuild — the 041/042/043/045 winners are untouched); the 041-A
  `ActiveView` full-surface pattern; the 136 `PublishGateDialog` shell.
- **Net-new:** the `skill-studio` ActiveView value (with a tab param; the old
  `skill-tuner` value redirects); the Studio header + tab chrome; the panel slim-down
  (SkillEvalSection/SkillTestCasesSection leave the edit dialog — the "messy UI" cure);
  ONE link added to PublishGateDialog (unmet → "Review evals →" → Studio · Evals).
- **Out of scope (declared):** chat → Studio links (a skill firing in chat) — not 137.
- **Consistency locks:** deep-linkable tabs (gate line → Evals, lint → Triggering,
  version row → Versions); `‹ Skills` preserves the selected skill + panel state
  (041-A contract); no orphan Tuner surface remains after absorption.
