---
sketch: 035
name: link-target-picker
question: "How does creating an outgoing link compose — the rel-type chooser + the searchable typeahead target picker (reusing the MoveToFolderDialog dialog shell), with self + already-linked candidates excluded, the error line, and a 'this supersedes → X' preview?"
winner: "A"
tags: [phase-117, document-relationships, create-link, typeahead, move-to-folder-dialog, outgoing-only, exclusion, honest-error]
---

# Sketch 035: Link Target Picker

## Design Question
SC#2 says create a link "reusing the `MoveToFolderDialog` document-picker pattern." D-117-3
keeps that **dialog + confirm + error-line shell** but **swaps its plain `Select`** (dies past
~30 docs) for a **searchable typeahead** — a KB can hold thousands of documents. This sketch
answers: how do the **rel-type chooser** and the **typeahead** compose, how are **self +
already-linked** candidates excluded (D-117-4), and how does the **error line** read
(D-117-10)?

All variants author an **outgoing-only** link from the open document (D-117-1) and end on a
**re-fetch** posture (D-117-9), not an optimistic insert.

## How to View
open .planning/sketches/035-link-target-picker/index.html

Type in the search box (↑/↓ to move, Enter to pick, Esc to clear). **Switch the relationship
type** and watch the candidate set change — documents already linked *with that type* drop out
(D-117-4), and the "N already … — hidden" note updates. Toggle **simulate failure** in the
footer, then **Add link**, to see the honest dialog error line. A successful Add shows the
"🛡 audit logged · re-fetched" receipt.

## Variants
- **A: Dialog, type-first** — the locked path. MoveToFolderDialog shell; rel-type segmented
  chips on top, then the typeahead; a live *"this document references → X"* preview; confirm
  disabled until a target is chosen; error line under the field.
- **B: Dialog, sentence-builder** — same dialog shell, but the form *is* a fill-in-the-blank
  sentence: "This document `[references ▾]` `[search a document…]`". The relationship is an
  inline dropdown; the target is the typeahead. Reads as plain language (no separate type row).
- **C: Inline foil ⚠** — the create form expands **inline inside the accordion** (no modal).
  Snappier in flow, but **deviates from D-117-3** and competes with the already-dense panel.
  Included only so the dialog-vs-inline trade-off is felt before confirming the locked path.

## What to Look For
- Does **type-first** (A) or the **sentence** (B) make the outgoing-direction + the chosen
  relationship clearer? Does B's inline type-dropdown feel discoverable, or hidden?
- Does the **per-type exclusion** read as helpful ("every pick is actionable") or as documents
  mysteriously missing? Is the "N already … — hidden" note enough?
- Is the **typeahead** obviously a search (not a fixed list)? Do keyboard nav + the match
  highlight feel right at KB scale?
- Is the **error line** honest and recoverable (the change wasn't recorded → try again)?
- Does the inline foil (C) tempt you away from the dialog, or confirm the dialog is right?

## Build Handover (reuse vs net-new)
- **Reuse:** `MoveToFolderDialog`'s Dialog/confirm/error-line shell (D-117-3) — keep it, swap
  the `Select` for the typeahead. `POST /document-relationships` is the live create call
  (Phase 116: visible-both gate → idempotent persist → `relationship.create` audit).
- **Net-new (117):** the typeahead candidate source + the **self & already-linked-per-type**
  exclusion (D-117-4) — client filter over a visible-docs fetch *or* a server param is
  researcher's discretion (least-complex correct option). Plus the `api.ts` create client fn.
- **Lock against drift:** create is **outgoing-only** (D-117-1) — to author "X supersedes
  this," open X's panel; idempotency (D-116-6) is the net for a stale candidate. On success →
  **re-fetch** (D-117-9), never optimistic. Mobile: bottom-sheet vs centered dialog is sketch/
  planner discretion (Claude's-discretion item in CONTEXT).

## Winner: Variant A — Dialog · type-first

Operator pick (2026-06-20). The locked path: rel-type chips on top, then the typeahead, with a
live "this document references → X" preview. Type-first makes the outgoing relationship explicit
before the target; reuses the `MoveToFolderDialog` dialog/confirm/error-line shell verbatim.

## A11y contract (SC#3 WCAG 2.1 AA — locked by fidelity audit `wf_1ec2afac-687`)
- **Typeahead is a combobox (net-new a11y):** the `Select`→typeahead swap loses APG roles the
  shadcn `Select` gave for free — the build must wire `role="combobox"` +
  `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input (highlighted row =
  `aria-activedescendant`), `role="listbox"` on the list, `role="option"`+id per candidate.
- **Focus-trap + restore** come free from the reused shadcn `Dialog` — keep the input INSIDE
  the dialog so the swap preserves both.
- **In-flight beat** (submitting → disabled confirm) is inherited from `MoveToFolderDialog`'s
  `loading` state; the sketch collapses the POST+re-fetch to instant only for brevity.
- **Contrast:** the exclusion note + "No matching documents" use the panel-scoped AA token,
  never the global dim (3.59–3.64:1).
