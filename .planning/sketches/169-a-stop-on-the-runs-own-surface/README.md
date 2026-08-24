---
sketch: 169
name: a-stop-on-the-runs-own-surface
question: "Where does Stop live on a surface that says 👁 View only — and does pressing it need a guard?"
winner: "A — in the title row (2026-08-16, operator), over the sketch's own lean toward B. ⚠ THE SKETCH'S B ARGUMENT IS CORRECTED RATHER THAN DEFENDED: 'the gate comes free' overstated it — `isTerminal` is a component-level const already in scope for BOTH rows, so A's liveness gate is one clause reading the same variable, not a new derivation. A also dodges a real hazard B has: the state row is `flex-wrap` and grows a long `claimed_at … → created_at … → updated_at …` string under the ⌥ reveal, so a control there wraps unpredictably. C rejected on canvas-vocabulary grounds (the lane beside a node already means ＋ insert / ✕ remove). Guard: direct flip. All variants stay as evidence."
tags: [phase-194.1, run-01, stop, workflow-run-page, canvas, action-guards, bug-260816-01, g-2]
---

# Sketch 169: A Stop on the run's own surface

> Second of three for Phase 194.1. It inherits sketch **168**'s pressed state — whatever
> 168 wins with, this control wears. **Decide 168 first.**

## How to view

```
start .planning/sketches/169-a-stop-on-the-runs-own-surface/index.html
```

Six tabs: **Today (no control)** · **A · In the title row** · **B · The state row owns it** ·
**C · On the running step** · **The guard question** · **The contract**.

The driver has two axes: **run state** (`● Running` / `Paused for your answer` / `✓ Complete`)
and **guard on the press** (direct flip / arm to confirm / naming sheet). The guard axis
applies to every variant, so you can feel A-with-a-sheet and C-with-a-flip.

## The question, stated so it cannot be misread

The operator, during Phase 194 UAT: *"there is no stop button in the canvas, I think this is
needed."* Measured the same day at `045a83dc`:

```bash
grep -c "stopThread\|cancelRun\|Stop" frontend/src/pages/WorkflowRunPage.tsx
# → 0
```

**Zero.** And this is the surface **▶ Run workflow** sends you to — the RunModal says so in as
many words (*"Run opens this workflow's run surface"*). So the natural launch path has no
working Stop at all:

| Step in the natural flow | Stop available? |
|---|---|
| Press ▶ Run workflow → land on the canvas run surface | ❌ **no control exists** |
| Switch threads, use the tray | ❌ silent no-op unless that thread was opened this session (`194-UAT.md` UAT-01) |
| Click *Open the chat thread*, then panel/composer Stop | ✅ works — and gives no feedback (sketch 168) |

**The Stop that works is the one you have to navigate to.** That is the defect.

⚠ Its own report classifies this as *"a scoping gap rather than a regression"* — the surface
was built read-only in Phase 188 and the Phase 194 mounts were scoped as panel / composer /
tray. Nobody broke it; nobody was assigned it.

## The variants

| | Where | Adds | Risks |
|---|---|---|---|
| **A** | **The title row**, opposite the seam link | Cheapest mount — the row exists, is already `flex`, and *Open the chat thread* is already `ml-auto`. | The header's own docblock says it is *"orientation, never a focal point; the only accent it spends is the seam link."* A asks it to spend a second accent, and puts a **primary-tinted link** next to a **destructive control**. |
| **B** | **The state row** that already says `● Running · 2m 18s since it was queued` | **The liveness gate comes free.** That row already computes `isTerminal` to choose its own wording. Flip the driver to `✓ Complete` and the control is simply not rendered — because the row already knew. | The row is a sentence about state; a verb in it may read as part of the reading rather than as a control. Judge it at the `Paused for your answer` setting, where the sentence is longest. |
| **C** | **On the running step**, on the lane beside the node | The only variant where the control and the work are in the same glance. On a long workflow that is a real difference. | **Canvas vocabulary.** §4 governs canvas marks, and the lane beside a node already spends itself on **＋ insert** and **✕ remove** — marks that mean *edit this workflow*. A stop there is one glance from reading as *delete this step*, on a surface whose own chrome says **👁 View only**. Phase 188.2 also pins that **no focusable control may live inside the card**, so C must mount on the lane — the same lane `＋`/`✕` own. |

## What to look for

1. **Flip to `✓ Complete` on each tab.** B's control disappears because the row it lives on
   already knows the run is terminal. A and C have to be *told*, and then that gate has to be
   defended forever. `BUG-260709-01` is re-opened precisely because the panel's gate asks the
   wrong question (`phases.length > 0` — phase rows outlive the run). **A gate you get for
   free cannot rot.**
2. **On C, look at the lane, not the button.** Does the control read as *stop the run* or as
   *remove this step*? That is the whole variant. If it is ambiguous here, on a page with
   three nodes and no edit affordances drawn, it will be worse on the real canvas where
   `＋` and `✕` are actually present.
3. **Switch the guard to “Naming sheet” and press.** Read it as someone who is watching their
   own run cost money. The sheet is *correct* — every sentence in it is true — and it is
   still the wrong instrument, because the thing being bought here is **speed of stopping**.
4. **A, at the `Paused for your answer` setting.** The title row is at its most crowded when
   the state row below is at its most verbose. If A survives that, it survives.

## The guard question — recommendation, stated rather than surveyed

The shipped ladder (`references/control-room-shell-and-receipts.md`): *irreversible + names a
victim → sheet; consequential but reversible → arm-to-confirm; reversible with no victim →
direct flip.*

A Stop is **your own run, which you launched and are watching.** Nothing stored is destroyed —
Phase 194 verified on seven live runs that completed phases survive and only the interrupted
one is marked. It is *not* resumable, so re-running pays for the completed steps again — real,
but not victim-shaped.

> **Recommendation: direct flip on all mounts.** If any single mount earns a guard it is
> **C**, and only because C sits in a click-to-pan region where an accidental press is a
> genuinely different risk from a button next to Send.

The asymmetry worth saying out loud: a Stop that is too easy costs you one run; a Stop that is
too hard costs you the reason the control exists.

## ⚠ What this sketch does NOT settle

- **What the surface shows *after* the stop.** `⊘ Cancelled` is already a shipped band
  sentence (`WorkflowRunPage.tsx:299`) and this page renders it, but *the thread's* memory of
  the stop is **sketch 170**.
- **Whether the canvas can host C at all.** The nodes drawn here are a **stand-in**, not
  `PhaseNodeCard`. That component has a two-badge ceiling enforced by an `@ts-expect-error`
  control and forbids focusable children. **This page cannot prove a mount fits** — a build
  must place it against the real canvas before C can be called cheap.

## PROVENANCE

Hand-composed against source read at `045a83dc`, not generated. Per `SEED-155`, treat the
unflagged regions as the acceptance bar and the flagged ones as drawings.

| Region | Status |
|---|---|
| Header: back link, title + `v{n}`, `Open the chat thread` at `ml-auto` | **shipped verbatim** (`WorkflowRunPage.tsx:862-880`, `COPY_OPEN_THREAD`) |
| State sentences `● Running` · `Paused for your answer` · `✓ Complete` · `⊘ Cancelled` · `✕ Failed at "…"` | **shipped verbatim** (`:279-302`) |
| Elapsed wording — live `2m 18s since it was queued`; terminal `Ran for 2m 18s — from when it was queued to its last update` | **shipped verbatim** (`:758-790`) |
| `👁 View only · the plane pans · steps stay put` | **shipped verbatim** (canvas chrome) |
| The destructive button treatment | **shipped, borrowed on purpose** from `WorkspacePanel.tsx:461` — so the app has one Stop, not two |
| **The Stop control on this surface** | **PROPOSAL** — net-new |
| **The canvas nodes** | **SIMPLIFIED STAND-IN** — not `WorkflowCanvas` / `PhaseNodeCard` |
| **The naming sheet and the armed state** | **PROPOSAL** — drawn to be judged, and recommended against |

**No net-new canvas glyph is introduced.** §4's table is `⛨ 🔒 ⤳ ＋ ✕ ↶ ↷ ◆`; the filled
square `■` is `RunCard`'s cancelled **state** mark and the lucide `Square` is the **control**
— Phase 194 drew that line from both sides (194-03 refused `■` for a Stop button; 194-04 drew
the complementary half). `⏹` appears in neither table and is not used here.
