---
sketch: 291
name: draft-removed
question: "After the draft lands, where do 'Removed: send email…' (D-15) and the fields-to-inputs mapping (D-09/D-12) show?"
winner: A
tags: [phase-291, auth-02, draft-arrival, d-14, d-15, removed-notice]
---

# Sketch 291: What the Files Could Not Do

## Design Question
Phase 291 D-14/D-15: a file can shape steps but can never add an action. When the server's guard
removes something a file asked for, the author sees it plainly, **only when it actually happened**,
in server words. D-09/D-12: every form field becomes an input the author can flip between *ask the
person* and *look it up*; a field the AI left out is added by the server and says so.

## How it was built (and the limit)
The arrival card is `DraftArrivalCard.tsx`'s markup **re-typed with its exact classes and shipped
words** (`ARRIVAL_BADGE`, `seedReceiptHeading`, `groundingFoldSummary`, `decisionsFoldSummary`,
`SEED_RECEIPT_NOTHING_COMMITTED`, `DECLARED_INPUTS_TITLE`), styled by the app's own CSS. It is **not
a live capture**: a real draft could not be produced to capture, because `POST /workflows/generate`
refused the test description 3 times in ~5 s ("The model couldn't produce a usable draft", DeepSeek,
loose door, 2026-10-22). The step list under the card is a labelled stand-in.

## How to View
Serve `.planning/sketches`, open `http://127.0.0.1:8765/291-draft-removed/index.html`.
Switch 1 removed / 2 removed / **nothing removed** (the card must look exactly as today), and open the inputs fold.

## Variants
- **A: A line on the card's face.** `⊘ Removed: send email. Only your description can add actions,
  not vendor-terms.pdf.` sits under the heading, always visible while the card is open.
- **B: A third fold.** "1 thing your files asked for was left out · see" joins the footer folds; the
  sentence is behind it.
- **C: In the step list.** The removed step shows as a dashed, struck-through ghost row where it
  would have been, carrying the same sentence. The card itself is unchanged.

All three share the new inputs fold: "7 inputs from vendor-onboarding-form.pdf · review", one row per
field with its type and an **Ask the person / Look it up** switch, and the server-added row marked
"Added by Syrel, not the AI".

## What to Look For
1. D-15 says "plainly". Does B's fold hide it too well? Does A over-weight a card measured to arrive 4 lines tall (sketch 174)?
2. C puts the fact where the author would look for the step. Does a ghost row read as "removed", or as "pending"?
3. With "Nothing removed", every variant must be byte-for-byte today's card (no "nothing removed" line).
4. Is the inputs fold the right home for D-09's flip, or does it belong in the existing "Asked when this runs" editor only?
