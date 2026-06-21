---
sketch: 034
name: relationship-section
question: "How do outgoing + incoming typed links read in the detail panel's Relationships accordion at a 3-second scan — rel-type chip vs sentence, the masked 'no access' row, the remove affordance, and where '+ Add link' sits?"
winner: "A"
tags: [phase-117, document-relationships, detail-panel, accordion, grouped-by-direction, inverse-labels, no-access-masking, honest-states]
---

# Sketch 034: Relationships Section

## Design Question
Phase 117 adds **one accordion section** to the existing Phase 112 `DocumentDetailPanel` —
it does **not** build a new surface. The section lists a document's **outgoing + incoming**
typed links (REL-02 / SC#1–3). This sketch answers: at a 3-second scan, how do those two
direction groups read — the rel-type chip, the inverse-labeled incoming rows, the masked
**"linked document (no access)"** row, the remove control, and the **+ Add link** entry?

All variants honor the locked decisions: **grouped-by-direction** (D-117-5, Outgoing then
Incoming), **inverse labels on incoming** (D-117-6, "Superseded by" etc. from the backend's
`_INVERSE_LABEL`), **outgoing-only create / either-direction remove** (D-117-1/2), and
**re-fetch-not-optimistic** mutation (D-117-9). They differ in *density and how loud the
relationship verb is*.

## How to View
open .planning/sketches/034-relationship-section/index.html

Use the **State** strip at the top of the panel to cycle populated / empty / loading / error.
The masked "no access" row is present in the populated state by default (it's load-bearing
honesty, not hidden behind a toggle). Hover a row to reveal **✕ remove** → watch the honest
"↻ updating" re-fetch flash. Click **+ Add link** to feel the create entry point (a stub —
the full typeahead picker is sketch 035).

## Variants
- **A: Chip-led grouped** — explicit "Outgoing N / Incoming N" subheaders; each row = a
  rel-type **pill chip** (verb word + per-type dot) + file + hover-reveal ✕; a dashed
  **+ Add link** button at the section foot. Most legible direction read; calmest.
- **B: Sentence-led** — rows read as prose: `↑ Supersedes **Risk Register.xlsx**` /
  `↓ Superseded by …`; the verb is inline text (no separate pill), thinner subheaders,
  denser. Create is a single inline pill: "+ Link this document to…".
- **C: Compact / dense** — a tight mono-tag-left / filename-right list built for documents
  with **many** links (scrolls within each group); + Add moves to the section header. Trades
  warmth for scan-many throughput.

## What to Look For
- Does **direction** read instantly — outgoing vs incoming — without reading every word?
- Do the **inverse labels** on incoming rows ("Amended by", "Referenced by") feel correct,
  or confusing next to the outgoing verbs?
- Is the **masked "no access"** row unmistakably *a real but unreadable link* (not an error,
  not an empty)? Does it still feel removable (you own the edge, D-117-2)?
- Does **remove** feel honest — the brief "updating" re-fetch beat vs an instant optimistic
  vanish (D-117-9)?
- Where does **+ Add link** want to live, and does it read as outgoing-only?
- Which density survives both a 3-link doc and a 12-link doc?

## Build Handover (reuse vs net-new)
- **Reuse:** `DocumentDetailPanel` shell + `PanelSection` accordion (count badge), the
  panel-scoped AA tokens, `useIsMobile` bottom-sheet, `onReconcile` re-fetch hook (112).
- **Reuse:** the inverse-label vocabulary `_INVERSE_LABEL` (D-117-6) — mirror it, don't
  invent wording; the `_NO_ACCESS_MASK` string for the masked row.
- **Net-new (the real work):** a `GET` read endpoint (Phase 116 shipped no REST read) whose
  leak-safe traversal is **extracted into `document_relationship_service`** and shared with
  the agent tool — never forked (D-117-7). Plus `api.ts` client fns + the Relationships
  `PanelSection`.
- **Lock against review drift:** create = outgoing-only, remove = either-direction
  (deliberate asymmetry, D-117-1/2); masked rows never leak id/title (D-117-8); empty ≠ error.
  Remove is a hard audited `DELETE` — **no undo** (an "Undo" implies optimistic reversibility
  the backend doesn't provide; D-117-9).

## Winner: Variant A — Chip-led grouped

Operator pick (2026-06-20). Calmest direction read; the rel-type pill + explicit
Outgoing/Incoming subheaders make the create/remove asymmetry (D-117-1/2) legible, and the
masked "no access" row sits cleanly in the outgoing group.

## A11y contract (SC#3 WCAG 2.1 AA — locked by fidelity audit `wf_1ec2afac-687`)
The build inherits these from the sketch as truth — do not drop them:
- **Remove (✕) reachability:** hover-reveal is mouse-only sugar. The control MUST be
  keyboard-operable (`:focus-visible`) and **always visible on touch / coarse-pointer** (the
  `<768px` bottom-sheet has no hover). Shipping hover-only would make the destructive
  either-direction remove (incl. masked rows) unreachable — a WCAG 2.4.7 fail.
- **Accessible names:** icon-only controls carry `aria-label` (shell pattern:
  `aria-label="Close document details"` + `aria-hidden` glyph). Remove announces
  `aria-label="Remove <type> link to <filename>"`. The accordion head reuses `PanelSection`'s
  real `<button aria-expanded aria-controls>` — don't re-implement a `div`.
- **Contrast:** the masked "no access" string (the SC#2 honesty surface) and all meaningful
  copy (subheaders, exclusion note, empty/error body) use the **panel-scoped AA token**
  (`--panel-muted-foreground` ≥4.5:1), NEVER the global muted/dim (3.59–3.64:1). Decorative
  glyphs (chevron, redundant per-row direction arrow) may stay dim.
- **Live regions:** the transient `↻ updating` re-fetch beat = `role="status" aria-live="polite"`;
  the load-error block = `role="alert"` (the 112 `DocumentDetailPanel` pattern).
- **Scaffolding note:** the Metadata (112) + Classification (118) sections shown around
  Relationships are sketch context only — 117 adds ONLY the Relationships `PanelSection`; the
  real panel ships no inert "coming soon" stub.
