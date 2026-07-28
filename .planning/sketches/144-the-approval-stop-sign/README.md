---
sketch: 144
name: the-approval-stop-sign
question: "Where does 'this step waits for your OK' live, so you can see it before a run and feel it during one — without adding a step to the flow?"
winner: null
tags: [phase-185, govern-03, action-risk, approval-checkpoint, connectors, phase-189, phase-190, armed-default, g2-sketch-gate]
---

# Sketch 144: The approval stop sign

## The question, in one line

Some steps do things you cannot take back — send an email, write to a shared drive, spend money. Those
steps can be made to **stop and ask you first.** Where does that stop sign live?

## Settled before drawing

**The checkpoint is a gate ON the risky step, not an extra step in the flow** (operator, 2026-07-28). Step
count and numbering stay true — "step 4 of 5" keeps meaning what it says. Whether it materialises as an
`llm_human_input` phase underneath is an engine detail the canvas hides. Both variants keep 5 steps; they
differ in *where* the sign lives, not in what the flow is made of.

## How to View

```
open .planning/sketches/144-the-approval-stop-sign/index.html
```

Three things to do, written on the screen.

## The two variants

- **A: A collar on the step.** The step wears a band along its bottom edge saying it will wait. The signal
  and the thing it guards are the same object — you can never mis-assign it.
- **B: A checkpoint on the way in.** The line leading into the step carries a stop mark, and the run
  visibly halts *before* the card rather than inside it. Nothing is added to the card at all.

## Why there are connector steps in this sketch

Steps 4 and 5 are an **email-out** and a **file-to-shared-drive**, drawn as a labelled forward preview of
**Phase 189** (the governed external-action node — no live sending) and **Phase 190** (2–3 live
connectors plus the SSRF / credential / cross-tenant security work that has to come with outbound
traffic).

They are here on purpose, at the operator's prompt (2026-07-28). Today only **9 steps in the entire
corpus** do anything outbound, which makes an approval gate look optional. The moment a workflow can
email a supplier or write to a team folder, this gate stops being a nice-to-have and becomes **the main
safety feature** — and the roadmap already commits to it: Phase 189 SC#2 says the external-action node
"carries the Phase-185 action-risk approval checkpoint **by default**."

Drawing 144 without a connector would be designing the seatbelt with no car.

The 3D connector marks (`connector_email`, `connector_link`) are the ones already extracted and verified
in `themes/phase-icons-3d.js` — the same set the shipped `PHASE_GLYPHS` map draws from. Connector steps
are drawn with a dashed edge and a `connector · later phase` label so nobody mistakes a preview for a
shipped capability.

## The finding that matters more than the variant

**Step 5 writes to your shared drive and nothing asks you.** That contrast is on screen at all times
rather than described — one outbound step armed, one not.

With no connectors built, that is harmless. The moment Phase 190 makes it real, an unarmed outbound step
*is* the risk. **Which argues the default should be armed-on, not armed-off** — a new external-action
step should arrive with its checkpoint already set, and turning it off should be the deliberate act.

Set **Approval → Off** and watch the foot line change to *"1 outbound step acts with no one asked"*, then
run it and read what the bar says: *"Nothing asked you. The email has already gone out."*

## What each variant costs

| | Cost |
|---|---|
| **A — collar** | Impossible to miss, impossible to mis-assign. But the bottom edge of a 248px card is crowded: the run chip sits under it and the editing actions live there too. **Three things now want that edge.** Watch the card grow when you arm it |
| **B — checkpoint** | Nothing added to the card, and the pause reads as what it truly is — the run stopping *before* the action. But the mark is 30px and lives in the gap between steps, the part of a flow the eye skips. Its label is wider than the 66px connector it sits on and needs its own backing — that width problem *is* the cost |

## Inherited, not re-asked

143-A's proven mark (corner seal load-bearing, edge reinforcement) and 137-B's card. Phase 188's status
colour is drawn on the border, which is why the "waiting for you" state must also read **without** it —
watch the collar or the checkpoint, not the glow.

## What to Look For

1. **Without reading — which step will stop and ask you? And which one just sends?**
2. **Set the run to *reached the email step*.** Does "waiting now" look different from "will wait"? Press
   *Not yet* — the run holds; it does not quietly time out and send.
3. **Turn approval Off.** Does the workflow start to look dangerous? It should.

## Verification

Driven in Chrome DevTools at 1440×900 across both variants × armed/disarmed × not-running/running:
the collar's rest-vs-waiting states, the checkpoint's rest-vs-waiting states, the approve bar and both
of its outcomes, the disarmed path (no collar, no pause, an honest "nothing asked you" notice), and the
foot counter flipping to *1 outbound step acts with no one asked*. 0 overlaps between the note cards,
the approve bar and any step across all four state combinations; no horizontal or vertical scroll. A
real defect found and fixed: the `connector · later phase` label was absolutely positioned above the
card and covered the floating 3D mark — the top edge of a 137-B card belongs to the icon, so the label
moved inside. No console errors; inline JS passes `node --check`; zero inline `on*` handlers.
