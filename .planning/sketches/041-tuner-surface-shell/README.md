---
sketch: 041
name: tuner-surface-shell
question: "What FORM does the Skill Trigger Tuner take, and where does it live relative to the 3-pane SkillsPage — given it's far bigger than the 384px detail panel?"
winner: "A"
tags: [phase-123, skill-triggering, trigger-tuner, surface, shell, ia, skills-page, trig-01]
---

# Sketch 041: Trigger Tuner — Surface & Shell

## Design Question

The Skill Trigger Tuner (TRIG-01 / D-07) is a multi-section surface: a benchmark **case editor**,
a **per-provider held-out scoreboard** (4 production models), a **candidate-rewrite list**, and a
**multi-minute background run**. The CONTEXT says it hangs off `SkillsPage` / `SkillDetailPanel` — but
the real `SkillDetailPanel` is only **384px** wide (the right pane of the 3-pane SkillsPage). So the
structural question: **where does the Tuner actually live, and how much surface does it claim?**

## How to View

`open .planning/sketches/041-tuner-surface-shell/index.html`

## Variants

- **A: Focused full-surface ★** — the Tuner takes over the whole working area (rail stays, list + detail
  hidden); reached from a "Tune triggers" action on the skill, returns via `‹ Skills`. Two-column body
  (description + benchmark + run on the left, scoreboard + candidates on the right). Mirrors the Workflow
  Studio publish-gauntlet precedent (a first-class focused surface via an `ActiveView` switch, no router).
- **B: Wide push/split panel** — the right inspector widens 384 → 640px; the **skill list stays visible**
  so you can hop to the next weak-trigger skill without leaving the loop. Single tall column.
- **C: In-panel accordion** — the standard 384px detail panel grows a "🎯 Triggers" accordion below the
  Description field. Zero new surface, fits the existing layout — but the scoreboard, candidates, and case
  editor all cram into one narrow column.

## What to Look For

- **Does the scoreboard + candidates + case editor breathe**, or fight for width? (A has room; C is cramped.)
- **The scan → tune → next loop:** B keeps the list visible (jump to next skill); A and C don't.
- **Consistency with the app:** A matches the publish-gauntlet "focused surface" precedent; B matches the
  document-detail push/split; C matches the inline-accordion (004-B) pattern.
- **The honesty anchors are present in all three:** the should-NOT-fire safety-rail count, the per-provider
  *production model-ids*, "current · live · drives firing" on the description, and **author-confirm → PATCH**
  (never auto-apply).

## Build Notes (reuse vs net-new)

- **Reuse:** the 3-pane `SkillsPage` chrome, `SkillDetailPanel`, the `ActiveView`/`NAV_ITEMS` no-router
  switch (variant A's focused surface), the document-detail push/split width pattern (variant B).
- **Net-new:** the Tuner surface itself + a tuner-run service/route; the entry action on the skill card/panel.
- The placement chosen here is **inherited by 042/043/044** (scoreboard, case editor, lint live inside it).
