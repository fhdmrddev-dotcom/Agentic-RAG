---
sketch: 037
name: rule-builder-and-list
question: "How does the dedicated Classification-rules surface compose — the rules list (status / scope / condition→action at a glance) + the builder (condition chip strip → suggested folder/tag → scope) + a live 'would match N docs' preview — reusing the 029 chip-strip and 031 NavRow/G patterns?"
winner: "A"
tags: [phase-118, auto-classification, rule-builder, rules-list, chip-strip, enable-disable, owner-global, live-count, dedicated-surface]
---

# Sketch 037: Classification Rule Builder & List

## Design Question
Phase 118 / CLASS-01. Users define classification rules (`metadata condition → suggested
folder/tag`), owner-private or global, enable/disable-able. **Decided in intake:** rules live on
a **dedicated "Classification rules" surface reached from Documents** (sidebar group "Automation",
peer to Folders + Views). This sketch answers: how does that surface compose, and where does the
builder open?

## How to View
open .planning/sketches/037-rule-builder-and-list/index.html

## Variants
- **A: List + side-panel builder** — the rules list on the surface; New/Edit opens the builder in the
  same **right-side push/split panel** the app already uses for document detail (027) and workflow
  phase forms (103). Condition **chip strip** (029-A: `field op value` + `＋condition`, AND) → action
  (radio: 📁 folder / 🏷 tag) → scope segmented (👤 Only me / 🌐 Global `G`) → live "would match N of
  248" preview. Consistent with the established panel-form grain.
- **B: Full-page builder** — New rule swaps the surface for a full-page builder (more room for many
  conditions + a preview rendered as a real doc list). Trade-off: leaves the list context; heavier
  than the in-place panel and against the no-router/state-switch grain.
- **C: Inline-expand rows** — each rule row expands in place to edit. Compact, no panel — but the chip
  strip + action + preview crowd a list row (the 035 audit rejected inline-expand for the link picker
  for the same reason).

## Shared rule-row anatomy
`● name [G] · condition (mono) → 📁/🏷 action · [toggle] · ⋯` — enabled dot (green) / disabled (dim),
`G` pill = global, toggle switch enables/disables live, kebab = edit/delete.

## Winner: A — List + side-panel builder ★ (2026-06-21)

The only variant consistent with the app's grain: the right-side push/split panel already authors
document detail (027) and workflow phase forms (103) — same shell, same `minmax(0,1fr) <panel>`,
no-router state-switch, straight React port. The list stays visible so author → check live-count →
save keeps its place. B (full-page) is heavier than short rules need and leaves the list context;
C (inline-expand) crowds the chip strip + action + preview into a row (rejected for the same reason
in the 035 link-picker audit).

## What to Look For
- The rule row: can you read **status + scope + condition→action** in one 3-second scan?
- Where the builder opens (panel A / page B / inline C): which keeps the **author → check preview →
  save** loop tightest without feeling cramped?
- The **chip-strip condition builder** reused from 029 — does `field op value` + AND read cleanly here?
- The **live "would match N" preview** + its honesty line: **"existing docs aren't moved — rules
  suggest on new uploads only."** Is that honest framing clear, or confusing? (Open question below.)
- The 📁-folder vs 🏷-tag action choice — legible and not fiddly?

## Open question (flag for discuss-phase)
The preview counts existing docs a rule *would* match, but per CLASS-02 rules only fire on **upload**
(`ingest_document` rule-eval pass) — existing docs are **not** retroactively suggested unless re-ingested.
The sketch states this honestly inline. Decide at discuss-phase whether to (a) keep preview-only (current),
(b) offer an explicit opt-in "run this rule across existing docs now" (a backfill suggestion pass), or
(c) leave it entirely to re-ingest. Mirrors the Phase 114 "no re-extraction / no backfill" integration truth.
