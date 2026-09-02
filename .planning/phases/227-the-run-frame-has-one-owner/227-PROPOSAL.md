# Phase 227 — The Run Frame Has One Owner

**Proposed 2026-09-03**, from Phase 224's execution. A **refactor phase**, not a feature phase —
it ships no new capability and the success condition is that nothing changes on screen.

---

## The one sentence

> One visual object — the run frame — is rendered by three files, none of which owns it, so every
> change to it becomes a negotiation between three hot files instead of an edit to one.

## Why now, and it is not a preference

⭐ **Phase 224 hit this wall twice in one plan, and I stopped both times rather than widen scope.**
`224-04` asked for two small visual changes — move the status line inside the frame, right-align each
step's result. Neither could be done inside the plan's declared `files_modified`, because the pieces
live in different files:

| file | renders | triple (2026-09-03) |
|---|---|---|
| `chat/MessageItem.tsx` | the terminal status line, the seam cards, the citation footer | **61 / 30 / 829** — *extraction due* |
| `chat/RunCard.tsx` | the frame, header, elapsed, the Thinking fold | **24 / 10 / 688** |
| `chat/ToolCallPanel.tsx` | the step rows and their results | **50 / 19 / 1019** — *extraction due* |
| `chat/ChatArea.tsx` | the docked approval, the composer seam | **68 / 33 / 633** |

**No file owns the frame.** That is the whole finding. It is not that 224 was scoped badly — any phase
touching this surface hits the same wall, and the next one will too.

## ⭐ THE GUARDRAIL PRODUCED THE DEFECT IT WAS PROTECTING AGAINST

This is the argument, and it is written in the source rather than inferred.

`MessageItem.tsx:841` said, in a comment, for two years:

> *"ADDITIVE ONLY — a new sibling renderer in MessageItem, never a touch of RunCard internals (G-5)."*

G-5 told a phase to avoid a hot file. The phase complied by **bolting a card onto the outside of the
run frame** — and **that bolt-on card is the exact defect Phase 224 exists to delete.** The operator's
own words on seeing it: *"I honestly do not see the point of adding this panel activity since it is
already in the workspace panel."*

**The guardrail protected the file and produced the bug.** Not through anyone's mistake — through the
mechanism working as designed.

## ⚠ AND THE LEDGER CANNOT SEE THE DIFFERENCE

`grep -c "honoured by construction" CLAUDE.md` → **56**.

Fifty-six rows record a phase that touched a G-5-firing file *without* taking its extraction. Each one
is individually reasonable. Together they are the mechanism by which a refactor obligation becomes
permanent: **every phase dodges the file, so the file never improves, so the next phase must dodge it
too.**

⭐ **"Honoured by construction" is booked as a discharge and is actually a deferral.** The ledger
therefore cannot distinguish *"this file is fine"* from *"everyone has been avoiding this file for two
years."* `MessageItem.tsx` has read **extraction due** across **30 phases**; `ToolCallPanel.tsx` across
**19**. G-5's own rule — *"≥ 3 prior phases on the same hot file → insert a dedicated refactor phase
BEFORE the next feature phase on that file"* — has been firing for dozens of phases and has never once
been taken on this surface.

**This phase is that rule being obeyed.**

## What must be TRUE when it is done

1. **One component owns the run frame** — header, rail, steps, terminal status, footer. `MessageItem`
   renders *a run*; it stops rendering pieces of one.
2. ⭐ **Nothing changes on screen.** This is a refactor: the success condition is a byte-identical
   rendered result on every state the frame has — streaming, settled, failed, timed-out, cancelled,
   paused-on-approval, no-tools, sub-agent. **A visual diff is the acceptance bar, not a passing suite.**
3. **The two changes 224 could not make become one-file edits** — moving the status line inside the
   frame, and the right-aligned result column — *without being made here*. This phase proves they are
   cheap; a later one decides whether to make them.
4. **`MessageItem.tsx` and `ToolCallPanel.tsx` come out of *extraction due*** honestly — by having
   actually lost the responsibility, not by a row being re-worded.
5. **The gate can see it.** The suites covering the frame are in `TARGETS` and `BASELINE` before the
   refactor starts, so a regression is caught by a test rather than by an eye.

## How we'd know this failed (G-6)

- ⭐ **The refactor changes the rendering and nobody notices, because the tests assert vocabulary
  rather than composition.** This repo's own recorded lesson: Phase 217 *"shipped green against a
  contract with 200 assertions about vocabulary and ZERO about composition"*, which forced 217.1.
  **A refactor with no visual contract is a rewrite with extra steps.**
- The frame gets an owner **and the old renderers stay**, so there are now four files instead of three.
  Deletion is the deliverable.
- Only `RunCard` is touched, leaving `MessageItem`'s terminal block and `ToolCallPanel`'s rows where
  they are — the two files whose rows say *extraction due* — so the debt is renamed, not paid.
- ⚠ **It grows a feature.** The moment this phase changes what the frame *says* rather than who *owns*
  it, it stops being verifiable against "nothing changed on screen." **The two 224 leftovers are
  explicitly NOT built here** for that reason.
- The gate work is left to the end, so the refactor's own regressions land unguarded.

## Not in scope, deliberately

- **The right-aligned result column** and **the status line moving inside the frame.** They are the
  motivation, not the content. ⚠ And the column has an unresolved conflict with the operator's
  **2026-08-31 noise audit** (`ToolCallPanel.tsx:420-430`), which *removed* a per-row column because
  *"the eye went to the least informative thing on it."* That question is answerable only once someone
  can see the whole frame in one file — which is what this phase produces.
- **The workspace panel.** `WorkspacePanel` is a cross-surface shell with no mount in any workflow
  page; it has its own seam and its own row.
- **Any change to what the agent DOES.** Render layer only.

## What makes this tractable rather than frightening

- **224 just made the surface smaller.** `MessageItem.tsx` went **863 → 829** by deleting two
  `SeamCard` arms — its first negative delta in a long time. ⭐ **The cheapest moment to take an
  extraction is immediately after something removed code from it**, and that is now.
- The frame's states are enumerable and already have vocabulary — Phase 174's tiered terminal states
  (129-C), Phase 095's status-node rail, Phase 076.2's Thinking fold. **This phase moves them; it does
  not redesign them.**
- `ChatArea.approval.test.tsx` (added 224-04) already pins the one-card invariant across the
  streaming/not-streaming complement, so the most fragile seam has a guard before the refactor starts.

## Flags

- ⚠ **G-2 applies in an unusual direction.** There is no new design, so there is nothing to sketch —
  but there IS a visual acceptance bar, and it cannot be met in jsdom. **The bar is a before/after
  drive of every frame state in a browser**, and it needs the operator.
- ⚠ **Four G-5 hot files, all firing, two reading *extraction due*.** Re-derive the triples at
  discuss-phase; the four above were measured 2026-09-03 and this ledger's own repeated finding is that
  a figure goes stale on the next commit that touches the file.
- ⚠ **Whoever built 224 must not review this**, and vice versa — the two phases share their entire
  blast radius.
- **No migration, no wire change, no new dependency.** If any appears, the phase has grown a feature.
