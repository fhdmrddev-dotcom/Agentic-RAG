---
sketch: 010
name: honesty-and-drafts
question: "How do we make the run honest — failures show as failures with a reason, the draft you're asked to review is visible, and intermediate results surface?"
winner: "C"
tags: [honesty, draft, rc-4, ask_user, batch, provenance, large-content, phase-094]
---

# Sketch 010: Honesty & Drafts

## Design Question
Three trust gaps from the 093 re-UAT, all owned by 094 SC#6:
1. **Failed-as-failed (RC-4):** a `failed` run currently renders as an empty `done` card (the
   backend returns normally after `run_failed`, so the terminal sentinel is wrongly `done`). It
   must render as **failed, with a reason** — never empty.
2. **Visible draft-before-ask_user (operator finding #2):** doc_qa pauses at "Does this draft
   answer your question?" but the **draft is never shown** (it's wire-only in `ask_user_prompt.draft`).
   You're asked to review something you can't see. The draft must be **visible**.
3. **Intermediate output:** batch sub-results + a provenance answer card (progressive disclosure,
   not just the final delta).

## How to View
open .planning/sketches/010-honesty-and-drafts/index.html

**Scenario cycler** (bottom-right): `Draft to review · Batch results · Failed run · Answer card`.
In the Failed scenario, click the **taxonomy chips** (max_steps / gate_failed / wall_clock_timeout /
reason_unknown) to see each failure type — including the "reason not captured" fallback.

## Variants (where does an attention-moment live?)
- **A: Inline in timeline** — the draft / failure renders inside its phase card on the spine. One
  consistent place, nothing pinned. Risk: an attention-moment can scroll out of view on a long run.
- **B: Pinned at top** — the attention-moment pins to the top (loud, unmissable) and stays. Risk:
  stale pinned cards accumulate after they're resolved.
- **C: Pin-while-active → fold ★** — loud while it needs you (pinned amber for draft, red for
  failure), then **folds back into the phase timeline as a record** once resolved. The calm-loud
  pattern, consistent with sketch 006 (dual-surface ask_user) + 008-D (timeline as record).

## What to Look For
- **Draft scenario:** the actual drafted answer is visible *above* the question + chips, labeled
  "DRAFT · not yet saved" so it can't be mistaken for the final answer. (The exact finding-#2 fix.)
- **Failed scenario:** does it read as honestly failed — *which* phase, *what* type, *why*, and
  *where* — with the `reason_unknown` fallback proving we never show empty success again?
- **Batch scenario:** the 4 sub-agent results are individually readable (click to expand) before
  the merge phase — the ghost-avatar fix taken further into real per-subtopic content.
- **Answer scenario:** the harness answer gets a provenance RunCard (`3 phases · 16 tools · 48
  sources`, expandable to the phase record) — parity with Deep tool-turns.

## Large drafts (operator concern, 2026-06-04)
A 2,000-word draft does NOT belong crammed in a ~30% panel column. Resolution (reuses sketch 005's
opt-in `⤢` wide-overlay rule — *preview in panel, never auto-widen*):
- **Short draft** → renders fully inline in the panel (no friction). Toggle "draft size: Short".
- **Long draft** → the panel shows a **faded preview + word count + `⤢ Review & edit full draft`**;
  clicking opens a **wide reading/editing overlay over the chat** (~760px, ~75 chars/line,
  contenteditable, Approve / Save-corrections in the footer). The review *action* stays anchored to
  the Confirm phase; only the *reading surface* widens.
- Generalizes: the final answer already uses the full-width chat (009); the panel's job for any
  large content (draft, big sub-result, file) is **preview + open-wide**, not cram. See toolbar
  "draft size: Short | Long ~2k".

## Recommendation
**C** — it matches what we already shipped: sketch 006 made `ask_user` a calm pin that resolves in
place; 008-D made the timeline the durable record. C applies the same calm-loud lifecycle to *both*
drafts and failures: loud when it needs you, quiet record when done. A risks losing the moment on a
long run; B leaves stale pins. (The draft/failure *content* is identical across variants — only the
placement differs.) Long-draft handling = preview-in-panel + opt-in wide overlay (above).
