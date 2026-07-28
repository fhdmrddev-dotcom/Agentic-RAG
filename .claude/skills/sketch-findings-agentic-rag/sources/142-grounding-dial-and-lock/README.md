---
sketch: 142
name: grounding-dial-and-lock
question: "A step that reads your documents is held to citing them, and that cannot be switched off. How does that read as a safety rail rather than as a broken setting?"
winner: "B"
tags: [phase-185, govern-01, grounding-mode, detected-lock, one-way, escalate-only, phaseformpanel, plain-language, g2-sketch-gate]
---

# Sketch 142: Which steps have to prove it

## The question, in one line

Some steps read your documents. Those steps have to be able to show where their answer came from — and
that is not a setting anyone can turn off. **How do you say that without it feeling like the app is
fighting you?**

## How to View

```
open .planning/sketches/142-grounding-dial-and-lock/index.html
```

There are three things to do, and they are written on the screen. Two tabs at the top are the two
answers being compared.

> **Winner: B — a switch that refuses** (operator, 2026-07-28). *"More user friendly with less reading.
> Information is good but crowded text also is not a good experience."* A stays on file: it says more,
> and it says it in a wall of prose the reader has to get through before the point arrives.

## The two variants

- **A: It just tells you.** The panel states where the step stands — *Must prove it* or *Free to think* —
  with the reason directly underneath. There is no switch to hunt for. Press **Let it off this** and it
  explains itself instead of greying out.
- **B: A switch that refuses.** A real two-position control on every step. On a step that reads your
  documents the loose side is struck through, and pressing it prints the reason right there. You see the
  door, and you see it locked.

## The rule both variants propose

This is the thing to accept or reject. The layout question comes second.

> **You can only undo a lock you created.**

| Why the step is locked | Can you unlock it? |
|---|---|
| It reads your documents | **No.** Turning off the document-reading tool is the only way |
| The report is already set to cite every claim | No — that existing setting owns it, same as today |
| You asked for it on a step that didn't need it | **Yes** — it was your call. If the step later starts reading documents, that takes over and the undo disappears |

Try it: on step 2 press **Make it prove it too**, then undo it — allowed. On step 1 press **Let it off
this** — refused. Same green lock, opposite answer, because the reasons differ.

## What changed after the first review (2026-07-28)

The first draft drew two **real** workflow rows from the database, following the house rule that sketches
never invent content. The operator's review killed it, and correctly:

> *"All the workflows in the database are just testing. We need it practical and right to the point."*

Every row in the corpus is an engineering fixture — `eval_coverage`, `split`, `fanout`, `deep_dive`.
Grounding the sketch in those made it **less** readable, not more: the design question was buried under
names that mean nothing to a business reader, on a screen asking a business reader to judge wording.

So this sketch draws a **realistic business workflow** — a monthly supplier risk report — and says so.
The rule bends here for one reason: the thing being judged *is* whether the words work for a business
user, so unreadable-but-real defeats the purpose.

**What stayed real, and must not drift:** the phase types, the document-reading tool names (the actual
`get_tools` registry), and the check that gets attached —
`{kind: "citations_required", config: {mode: "deterministic"}}`, the shape used by 42 of the 43 citation
gates in the corpus.

**Also cut in the same review:** the whole "what happens to your existing workflows" section. The first
draft made a control out of it (grandfather the 36 ungoverned steps, or lock everything at once). With
every row being throwaway test data there is no migration problem to design around — **detection simply
applies.** One fewer decision to make.

## The detection rule is a named list, not a judgement call

A step "reads your documents" if it has any of these switched on: `search_documents`, `query_documents`,
`read_document`, `analyze_document`, `get_related_documents`. If the rule were fuzzy, nobody could predict
when the lock appears — and an unpredictable safety rail is worse than none.

## One thing this sketch refuses to draw

The requirement is worded "`citations_required` **+ confidence gate**". **There is no confidence field
anywhere in the engine** — `grep -rn confidence backend/app/services/harness/ backend/app/models/harness.py`
returns nothing, and the shipped check is deterministic: anything it cannot back up fails, full stop.
There is no threshold to set.

So Phase 185 either builds a real confidence number — a new field and new engine surface — or that word
leaves the requirement. Nothing is drawn for it, because drawing it would invent it. **Decide at spec
time, not build time.**

## What this sketch deliberately does NOT do

It does not invent how a locked step is marked **on the canvas**. The node faces are exactly what 183/184
ship. Sketch 143 owns that question, and answering it here would decide it by accident.

## The question B's first review produced — and the answer that strengthened the design

> *"If the first step is free, how does this workflow work at all? Find risks in our supplier files — if
> I make it free, what is the value?"*

**It doesn't work, and that is the point.** Switching off *Search your documents* does not make step 1 a
looser version of itself — it makes it a step that cannot open your files at all. "Find the risks in our
supplier files" becomes "invent plausible supplier risks from general knowledge." So the only route
around the citation requirement **destroys the reason the step exists**. It is a rail, not a loophole,
and nobody walks through that door because there is nothing on the other side of it.

**The first draft's wording hid this** — it read *"turn that off if the step really should not be [held
to sources]"*, which frames a lobotomy as a reasonable alternative. Rewritten in both variants and in the
toast: switching the tool off is named for what it costs, not offered as an option.

**Where *free to think* actually earns its place:** on the steps that think, not the steps that read.
Step 2 weighs up what step 1 already found and proved — judgement, ranking, "these three matter most."
It makes no new factual claim of its own, so there is nothing to cite, and demanding a citation would be
nonsense. B's free-state copy now says this in-surface rather than leaving the reader to work it out.

**The product argument, in one line:** the value is not that everything is strict — it is that a reader
can tell which half is proven and which half is opinion.

## What to Look For

1. **Read the refusal in A.** Does it explain, or does it scold? Someone reads that sentence three times a
   week.
2. **Switch off the document-reading tool and watch the lock go.** The only exit is changing what the step
   *does*, not what it is allowed to get away with. Fair, or a puzzle?
3. **Which tab you'd rather live in** — no switch at all (A), or a switch you can see refusing (B).

## Verification

Driven in Chrome DevTools at 1440×900 across both variants × all 4 steps: the refusal paths (A's button,
B's struck-through position), the escalate → undo asymmetry, the lock dissolving when the tool is switched
off and re-forming when it is switched back on, the *nothing to prove here* step (A states it, B removes
the control entirely), the already-set report step, and the ⌥ reveal (0 technical strings visible in plain
mode, 13 under ⌥ — a real defect caught and fixed: an inline `display` had been leaking raw tool ids into
plain-language mode). No console errors; inline JS passes `node --check`; zero inline `on*` handlers.
