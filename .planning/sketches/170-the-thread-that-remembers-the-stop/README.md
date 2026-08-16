---
sketch: 170
name: the-thread-that-remembers-the-stop
question: "What does a stopped workflow thread show on return — and what happens to the approval card that was on screen when you stopped?"
winner: null
tags: [phase-194.1, run-01, run-honesty, stopped-state, zombie-approval, bug-260816-02, bug-260710-01, bug-260610-01, g-2]
---

# Sketch 170: The thread that remembers the stop

> Third of four for Phase 194.1. **168** decides the press, **169** decides where a fifth
> control goes, **170** decides what is left behind, **171** decides whether the kickoff
> moment can draw itself twice.

## How to view

```
start .planning/sketches/170-the-thread-that-remembers-the-stop/index.html
```

Five tabs: **Today (broken)** · **A · The dim tier** · **B · The durable receipt** ·
**C · Chat stays thin** · **The contract**.

Two driver axes: **when you are looking** (live +5 s / live +13 s / you navigated away and
came back) and **what the run had done when you stopped it** (written some output / nothing
visible yet / waiting at an approval).

## The question, stated so it cannot be misread

The operator, during Phase 194 UAT (2026-08-16):

> *"if the workflow is stopped, if I navigate back to the thread of this workflow that was —
> there is nothing showing that this workflow is stopped, it's only showing the original
> prompt."*

**The stored truth is right.** Phase 194 verified it on seven live runs: `workflow_runs.status
= 'cancelled'`, the interrupted `workflow_phases` row cancelled, completed phases untouched,
`threads.active_workflow_run_id = NULL`, producer `runs` row cancelled. Only the display is
wrong — and it is wrong **in opposite directions at the two moments a person looks**:

| Moment | What the screen says | Measured |
|---|---|---|
| **Live**, still on the page | renders as **Running**; at +13 s the word "Stopped" appears **nowhere** while Postgres reads `cancelled`; an approval card is still offered | `194-UAT.md` UAT-02, driven on an armed-approval run |
| **On return** | the "this was stopped" signal is **gone entirely** — indistinguishable from a run that never started or one that finished | operator report, `BUG-260816-02` |

The zombie approval is the sharper half: **it invites an action that will silently go
nowhere.**

## The variants

| | Approach | Adds | Risks |
|---|---|---|---|
| **A** | **The dim tier, extended.** Apply Phase 174's shipped tier-1 vocabulary — `⊘ Response stopped` inline, or the dashed `⊘ Cancelled — no output yet` body — to a workflow thread. | Almost nothing. It is adopted design (174 D1/D2) applied to a second surface. | **It hangs off the assistant message.** A workflow stop can leave a thread whose assistant row carries no content at all, and `runs.message_id` is NULL on **587 of 607** harness runs. Drive *Nothing visible yet* and ask what A attaches to. |
| **B** | **A durable receipt**, derived from `workflow_runs` rather than from a message: `⊘ Stopped by you · 2 of 3 steps · 2m 18s` + a seam to the run. | Cannot be lost, because it is not attached to anything that can be missing. Reads identically in all three shapes. | Chat does not read `workflow_runs` by thread today. And Phase 194's **D-14** examined this exact file eleven days ago and **declined** to thicken the receipt. B is a deliberate argument against that decision — if it wins, the reversal is the thing to record. |
| **C** | **Chat stays thin; the panel spine carries it.** The strictest reading of the shipped 094/103 split. The spine already reads `act ■ Stopped` correctly after a reload; C's work is making it read that way *live*. | Cheapest. Changes nothing in the transcript. | **Judge it against the actual complaint** — the operator was looking at *the thread*. Collapse the panel (a legitimate, common state) and C has nothing. Most likely to close the bug on paper while leaving the reported experience intact. |

## What to look for

1. **Set *Nothing visible yet* and compare A against B.** This is the decisive comparison.
   A's marker needs a message to hang on; B's does not. If harness runs really do leave 96.7 %
   of `message_id` NULL, that is not an edge case, it is the common shape.
2. **Set *Waiting at an approval*, then step +5 s → +13 s on the Today tab.** The card is
   still actionable while Postgres reads `cancelled`. Then look at how each variant retires
   it. ⚠ **All three retire it with a sentence rather than removing it** — a card that
   vanishes mid-read is its own small dishonesty, and that is a rule, not a variant.
3. **Switch to *You navigated away and came back* on Today.** The thread ends at the prompt.
   That is the whole bug, and it is one screen.
4. **Watch the panel column on the Today tab.** The clock reads **28s** on nav-back instead of
   2m 18s — `BUG-260610-01`'s timer half, drawn beside the stop bug because the operator hit
   both in one session.

## ⚠ The decision this sketch cannot make alone

`BUG-260710-01` (*Deep chat message loses its "stopped" badge on nav*, 2026-07-10) and
`BUG-260816-02` (this one) are **the same family on two surfaces**. One is a Deep chat
*message*; this is a *harness run* whose thread carries a spine, a receipt and a kickoff
prompt — a different renderer over a different source of truth (`workflow_runs` +
`workflow_phases`, not `runs`).

**A fix to one does not automatically fix the other.** Whether 194.1 closes both or only the
workflow half is a scoping call for `194.1-CONTEXT.md`. ⚠ And if it closes only one, the
other's **frontmatter** must say so — `BUG-260710-01` currently reads `status: folded,
folded_into: "174", verified_closed_by: null`, which is exactly how a live bug stays invisible
to the routing scan for two months.

## Binds regardless of winner

1. **Derived from persisted state, never from live streaming state.** Phase 174 D1 already
   says it. A live-only badge is *how* this bug is two months old.
2. **A pending approval must not survive the stop** — retired with a sentence, not silently
   removed.
3. **The stop must not read as though nothing survived.** Phase 194 **D-13** keeps a stopped
   run's completed phases and explicitly rejects *"collapsing to a bare `cancelled` that hides
   partial work … it discards evidence the database still holds."* Every variant carries the
   step count in the same sentence as the word.

## PROVENANCE

| Region | Status |
|---|---|
| `Run · {n} steps · ■ cancelled · {elapsed}` strip, Bot mark, expand chevron | **shipped verbatim** — `RunCard.tsx:375-400` |
| `⊘ Response stopped …` and the dashed `⊘ Cancelled — no output yet` | **shipped design** — 174 D1/D2, `references/run-state-honesty.md`. ⚠ adopted, never `verified_closed_by` anything |
| Panel spine `act ■ Stopped` / `Phase 2 of 3, act, stopped` | **shipped** — Phase 194 plan 194-04; correct on reload today |
| **The durable thread receipt (B)** | **PROPOSAL**, and an argument against Phase 194 D-14 |
| **The retired-approval sentence** | **PROPOSAL** — net-new copy |
| The approval card's own wording | ⚠ **OBSERVED, not sourced** — transcribed from the Phase 194 UAT report, which recorded it from the screen. A build must read the real `PendingAskCard`. |

**Drawn as outcomes, not re-decided:** one avatar rather than two, and the clock reading
`2m 18s` after nav-back rather than restarting — Phase 174 **D6**. *How* two avatars stop
being drawable is **sketch 171**.
