---
sketch: 036
name: classification-suggestion
question: "How does an upload-time classification suggestion read + accept/dismiss — honest 'suggested, not moved', shows the matched rule, reversible, audit receipt on accept — in the detail-panel Classification section AND on the document row?"
winner: "A"
tags: [phase-118, auto-classification, suggestion, detail-panel, document-row, honesty, accept-dismiss, audit, reversible]
---

# Sketch 036: Classification Suggestion

## Design Question
Phase 118 / CLASS-02/03. On upload, a rule-eval pass writes a *suggestion* into
`metadata._classification` — **never a silent auto-move**. The user accepts (→ move +
`classification.apply` audit) or dismisses, and the whole flow is reversible. Where does
that suggestion live and how does accept/dismiss read — honestly?

Two truths the design must carry:
- **"Suggested" ≠ "moved."** The file stays where it was uploaded until you Accept.
- **A rule match is deterministic.** Show the *matched rule + condition* (provenance),
  never a fabricated confidence % (the 028 honesty principle applied to classification).

## How to View
open .planning/sketches/036-classification-suggestion/index.html

## Variants
- **A: On the doc (row chip + panel card)** — the suggestion is attached to the document. A
  compact `→ folder ✓ ✕` chip on the list row for one-glance accept/dismiss; the detail panel's
  `Classification` section (the reserved 027/028 slot) carries the full card: matched-rule
  provenance, "⚠ not moved yet", Accept & move / Dismiss, then the green "🛡 audit logged"
  receipt + "↩ Undo / move back". State cycler toggles suggested / accepted / dismissed / no-match.
- **B: Review tray** — a centralized "Suggestions to review (N)" tray at the top of the Documents
  page; per-doc cards with rule provenance + Accept/Dismiss. Honesty guard: **every Accept is
  individual** (own audit row) — deliberately **no "Accept all"** (mirrors the 028 cut of bulk-confirm
  that manufactures false provenance).
- **C: Panel-only (row dot)** — the list row gets only a quiet pulsing dot; all accept/dismiss lives
  in the panel's `Classification` section, forcing the decision into the document's full context.

## Winner: A — On the doc (row chip + panel card) ★ (2026-06-21)

The suggestion belongs to the document, not a separate inbox — A fills the reserved 027/028
`Classification` slot (reuse, not rebuild) and keeps the "why it matched" provenance attached to the
decision. Two honest speeds: one-glance row chip for the confident case, full provenance card when you
want to see the rule. C (panel-only dot) under-signals an action that needs you; B (tray) as the
*primary* surface divorces the decision from the doc and re-introduces the false-provenance risk the
028 bulk-confirm was cut for.

**Graft from B (carry into discuss-phase):** keep the tray concept as a **secondary launcher only** —
a small "N suggestions to review" affordance (Documents header or the `/Inbox` folder) that walks you
doc-by-doc through the *same A panel card*. Triage-at-scale with no second accept/dismiss UI and no
"Accept all."

## What to Look For
- Does "suggested, not moved" read **instantly** and honestly, or could a user think the file already moved?
- Row chip (A) vs centralized tray (B) vs panel-only (C): which makes the **accept/dismiss loop** feel
  fast without losing the "why it matched" context?
- The applied state: is the **🛡 audit receipt + reversible Undo** reassuring or noisy?
- Provenance (matched rule + condition) vs a tempting fake "92% confident" — does the honest version
  feel trustworthy enough?
- Empty / no-match state: calm, or does it nag?
