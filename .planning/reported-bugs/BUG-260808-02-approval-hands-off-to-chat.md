---
id: BUG-260808-02
title: A workflow that pauses for approval gives the run surface no way to answer — the user is handed off to chat, which the 146-A design decision explicitly rules out
reported: 2026-08-08
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/workflow-run-surface, frontend/approval-checkpoint, frontend/chat-panel-seam, information-architecture]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-139, SEED-136]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: HEAD at the 189-16 owed-rows UAT session (post 690ead48)
  date: 2026-08-08
---

# BUG-260808-02: the approval pause hands the user off to chat

> Raised by the operator on **2026-08-08**, during the 189-16 owed-rows UAT — and this is the
> **second** time. The same observation is quoted verbatim in the sketch findings from
> **2026-07-28**. It has an approved design decision against it, and that decision is not what ships.

## What we observed

A published workflow with an armed external-action step was launched and ran on the dedicated run
surface — the spine, the phase readings and the live status all rendered there correctly. When the
run reached the armed checkpoint it **paused and correctly refused to continue** (D-04 / 189-14,
working as designed).

But the run surface offered **no way to answer**. Its only controls were:

```
["Workflows", "Open the chat thread", "⌥ Technical names"]
```

To approve, the user must click **"Open the chat thread"**, leave the run surface, find the thread
in the chat list, and answer there. The approval controls
(`Approve and run this step` / `Do not run it` / free text) live only in the chat stream.

## Why it matters — there is an approved decision saying otherwise

`references/approval-and-review.md` § **"146-A — the round trip: one place"** (winner A over B):

> The canvas you built on is the canvas you watch. Launching takes you nowhere; a pause **grows the
> document over the canvas**, which stays visible behind it; approving closes it and you are already
> where the run continues. **No hand-off, no "where did it go", no return destination to decide.**

And the section directly beneath it, **"The run surface is NOT the chat stream"**, records the
operator saying this on **2026-07-28**:

> *"we click the workflow, it runs, then I see it suddenly in the chat."*

The same doc notes this was **"a proposal to Phase 188, not a commitment inside 185"**.

**Phase 188 delivered half of it.** The dedicated run surface exists and is what you land on — that
part shipped and works. What did not follow is the **approval interaction**: the pause still hands
off to chat, which is precisely the "hand-off / where did it go / return destination" that 146-A was
chosen to eliminate.

The `ask_user` sketch (`references/pending-question.md`, sketch 006 winner C — Dual-surface, mapped
to PANEL-04 / TOOL-03 / Phase 087 SC#4) independently reaches the same shape for the chat-agent case:

> The real input lives in a **calm pinned card at the top of the panel** … A **pointer cue inside the
> chat run-card** ("⚠ the agent needs your input → Answer in panel") points to it. … The chat cue is
> a **pointer**, not a duplicate input.

So both sketches agree: **chat may point at the question; it should not be the only place to answer
it.** Today it is the only place, and there is not even a pointer on the run surface — just a generic
"Open the chat thread".

Severity **major** rather than blocker: the run does not fail and the approval is reachable, so
nothing is lost. But every governed workflow — which is the entire point of Phase 185 and 189 —
pauses at least once, so this is on the critical path of the milestone's headline feature, and the
hand-off is the exact friction two separate sketches were commissioned to remove.

## Not folded into Phase 189 — operator decision, 2026-08-08

> The operator raised this while reviewing 189's UAT and said explicitly: *do not fold this into this
> phase, just take note.*

Recorded here rather than in `189-VALIDATION.md` because it is **not a 189 defect**. 189's armed
checkpoint behaved correctly (it paused and refused). What is missing is a run-surface affordance
that neither 185, 188 nor 189 committed to build.

## Suggested routing

- **Fold into in-flight phase:** no — 189 is at its close gate, and this is a new capability.
- **Defer to future phase:** **yes.** Natural owner is the next workflow-surface phase. It pairs
  tightly with `SEED-140` (no stop control on the same surface) and `SEED-139` (run threads
  indistinguishable in the chat list) — all three are the same underlying question: *what does the
  run surface own, and what is chat for?* Doing them together is one coherent phase; doing them
  separately means touching the run surface three times.
- **Plant as seed:** the three above may be better framed as one seed if a phase does not claim them.
- **External — note only:** no

## Reference / evidence links

- `.claude/skills/sketch-findings-agentic-rag/references/approval-and-review.md` § 146-A and § "The run surface is NOT the chat stream" — the approved decision and the 2026-07-28 quote
- `.claude/skills/sketch-findings-agentic-rag/references/pending-question.md` — sketch 006 winner C, the dual-surface shape (input in panel, pointer in chat)
- `189-VALIDATION.md` § "The live armed checkpoint — observed" — the driven observation behind this report
- `SEED-139` — run threads indistinguishable from chats; same IA question
- `project_workflow_runs_leak_into_chat` (memory) — the original "launching redirects into Chat" note
