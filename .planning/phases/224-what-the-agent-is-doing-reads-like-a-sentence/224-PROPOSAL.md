# Phase 224 — What the Agent Is Doing Reads Like a Sentence

**Proposed 2026-09-02** from the same UAT drive as Phase 223. Scoping only — it stops where
`/gsd:sketch` takes over, and ⚠ **the sketch is not optional here** (G-2).

---

## The one sentence

> While the agent works and after it stops, the chat column says **what it did in words a person
> would use** — instead of a raw `WRITE_TODOS`, a step orphaned outside the run that counts it, and
> an approval card that expires below the fold.

## Why this is one phase and not four tickets

The operator raised the same complaint twice, six weeks apart, at two altitudes:

- **2026-07-22** — `SEED-128`, *"Claude.ai-style collapsible run/reasoning timeline"*. Planted,
  then **`dormant` for six weeks** because its trigger named Phase 178 and Phase 178 never ran.
- **2026-09-02** — *"observe the layout, how the chat tools are not fitting exactly if we open the
  chat and the workspace altogether"* → `SEED-240`.

⭐ **They are the same question — *what does the agent's own activity look like?* — and sketching
them separately would produce two vocabularies for one surface.** That is the argument for a
phase rather than a polish pass.

## What is in scope

**① The tool card speaks machine** (`SEED-240`). Measured on a live thread:

- The card's title is **`WRITE_TODOS`** — the raw function name, uppercase with an underscore.
  ⚠ **Phase 209 is literally titled *"A step says what it actually does"* and Phase 214 shipped
  `StepIdentity` for exactly this. This card adopted neither.** It is the last place in the
  product speaking machine at a person.
- Its body reads **`☑ 1 todos`** — ungrammatical, and it does not say *which* todo. The panel
  300 px away knows.
- ⚠ **The card sits OUTSIDE the run frame.** The run says `Run · 3 steps`, enumerates none of
  them, and one step renders as an orphan beneath *"Agent reached time limit"* — itself prefixed
  by an **empty checkbox glyph**, so a sentence explaining why the run died wears the costume of
  an unfinished task. **This is the composition fault, and it is why the column reads cluttered
  rather than merely narrow.**

**② The proportions** (`SEED-240`). At 1536 × 639 — an ordinary laptop — four columns: nav 215,
list 305, **chat 700**, panel 308. The conversation gets **45%** of the screen. In the panel's
308 px a todo label is allotted 186 px before its status badge, so *"Search knowledge base for
report data"* wraps mid-phrase **and the badge aligns to the first line only**. ⚠ **The wrap point
is chosen by the badge, not by the sentence.**

**③ The reasoning timeline** (`SEED-128`) — the operator's original ask, six weeks old.

**④ The approval card's duration and visibility** (`BUG-260902-04`, the two halves Phase 223
does not take). Measured twice with the operator at the keyboard: **both runs expired at ~2 m 05 s**
against a hardcoded `timeout=120.0` with **no countdown anywhere**. ⚠ **And it compounds with ①**
— the card renders below the fold behind the composer, so **the clock runs while the buttons are
off screen.** ⭐ **A safety gate that is annoying to satisfy is a safety gate that gets switched
off** — it trains a person toward `Always allow`, the permanent grant.

## Success criteria (what must be TRUE)

1. **No raw identifier reaches a person.** A tool card in chat names its action the way
   `StepIdentity` already does elsewhere; `WRITE_TODOS` and its siblings do not appear.
2. **A run's steps are inside the run.** A card that belongs to `Run · N steps` renders as one of
   those N, not as a sibling beneath it.
3. **A status sentence does not wear a control's costume** — no checkbox glyph on *"Agent reached
   time limit"*.
4. **The approval card is reachable when it arrives**, and **says how long it has**. ⚠ Whatever
   duration is chosen, **the card must show it** — the current failure is not that 120 s is short,
   it is that the person cannot see the clock.
5. **The reasoning timeline** answers `SEED-128` — collapsible, and honest about the silence gap
   (`SEED-030`).

## How we'd know this failed (G-6)

- ⭐ **The sketch is drawn but the build diverges from it.** This repo's own recorded lesson:
  Phase 217 *"shipped green against a contract with 200 assertions about vocabulary and ZERO about
  composition"*, which forced 217.1. **The composition is the whole point here** — a contract that
  only checks words would pass a build with the card still outside the run frame.
- The vocabulary is fixed but the **layout is not**, so `WRITE_TODOS` becomes a nice sentence that
  still renders in the wrong place.
- The approval countdown is added and the **card still lands below the fold** — the clock becomes
  visible only once you scroll to it.
- Panel width is changed by eye rather than by the measurement above, and the badge still dictates
  the wrap point.
- ⚠ **It absorbs `BUG-260902-01`** (todos stranded `in_progress` on 25 threads). See below.

## Not in scope — with the coupling named

⚠ **`BUG-260902-01` stays OUT, but this phase owes it one thing.** That bug is a *data* defect: a
todo abandoned mid-run keeps `status: in_progress` forever because nothing but the agent's own
`write_todos` ever writes that column, and **25 threads carry one today, mostly behind runs that
COMPLETED normally.** Its fix needs a state that does not exist — *abandoned* / *not finished* —
because flipping to `completed` is a lie and to `pending` erases that work was attempted.

⭐ **Naming and drawing that state is cheap while sketching and expensive later.** So: **the sketch
should show what an abandoned todo looks like; the backend write that produces it is not this
phase's.** Recorded so the coupling is deliberate rather than discovered.

Also out: `BUG-260902-06` (per-worker cache — no shared surface), and everything in Phase 223.

## Flags

- ⚠ **G-2 FIRES and must not be waived.** `/gsd:sketch` before planning. ⚠ **And note the order
  failure to avoid**: Phase 222's CONTEXT locked presentation decisions *before* the sketch that
  was supposed to judge them.
- ⚠ **G-5 hot files, all four in the blast radius, triples to be re-derived at discuss-phase:**
  `MessageItem.tsx` (57/29/856, extraction due) · `ToolCallPanel.tsx` (47/19/995, extraction due) ·
  `ChatArea.tsx` (63/30/571) · `WorkspacePanel.tsx` (16/10/646). ⚠ **Two of them already read
  *extraction due* and have for some time** — this phase either takes that seam or records why not.
- ⚠ **The panel is a CROSS-SURFACE shell mounted by `ChatLayout`** — `WorkspacePanel` has no mount
  in any workflow page, so **redesigning it lands in CHAT first**, and UAT on the workflow surface
  alone will miss it.
- **`SEED-128` was flipped `dormant` → `planted` on 2026-09-02** so the `/gsd:new-milestone` sweep
  can see it. Its six dormant weeks are the argument for doing this now.
