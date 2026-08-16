---
sketch: 168
name: the-press-that-says-it-heard-you
question: "What does Stop look like between the press and the run actually ending — and what stands where it stood once there is nothing left to stop?"
winner: "B — the control yields (2026-08-16, operator). Chosen because ⊘ is already shipped tier-1 vocabulary (174 D1/D2) so no net-new glyph is introduced, and because a double-press is impossible by construction rather than defended. A and C stay as evidence. ⚠ TWO THINGS RIDE ON B AND MUST BE SETTLED IN CONTEXT: (1) the composer's slot width — a 32px icon button and a text line are different sizes, and B must not be forked to icon-only there or 168's whole premise dies; (2) B's losing arm is LOAD-BEARING, not a nicety — B removes the control during the stopping window, so the timeout is the ONLY route back to a pressable Stop."
tags: [phase-194.1, run-01, stop, pressed-state, run-honesty, bug-260816-01, bug-260709-01, g-2]
---

# Sketch 168: The press that says it heard you

> The first of three for Phase 194.1. **168 decides the pressed state, 169 decides where a
> fifth control goes, 170 decides what the thread remembers.** 169 inherits whatever 168
> wins with — a fifth Stop that acknowledges differently from the other four is a worse
> outcome than no fifth Stop.

## How to view

```
start .planning/sketches/168-the-press-that-says-it-heard-you/index.html
```

Five tabs: **Today (broken)** · **A · In place** · **B · The control yields** ·
**C · Surface-first** · **The contract**.

The driver at the top is shared by every tab. Two axes, and both matter:
*what is actually true right now* (a run is streaming / the run already finished / no run id
resolvable) and *how long the cancel takes* (0.4 s / 4 s / **never resolves**).

## The question, stated so it cannot be misread

The operator's words, during Phase 194 UAT (2026-08-16):

> *"when we open the workflow in the chat and you click button in the chat box it is not
> showing a loader, not showing the user that it is stopping the request, which is a little
> bit confusing."*

**This is not a request for a spinner.** Phase 194 landed the durable half and verified it on
seven live runs — `workflow_runs.status`, the interrupted `workflow_phases` row, the thread
anchor and the producer `runs` row are all correct. What is missing is that a person cannot
perceive any of it. And the reason it is `major` rather than ergonomic is in
`BUG-260816-01` § *Why it matters*:

> *(a) and (b) are individually minor ergonomics; they are filed at major because they are
> what makes UAT-01 **invisible** — a Stop that silently does nothing is indistinguishable
> from a Stop that is working but slow, precisely because there is no pending state to
> distinguish them.*

So the pending state is not decoration. **It is the instrument that separates a working Stop
from a broken one**, and this app currently has three distinct ways for a Stop to do nothing.

## The four mounts, and why they are on one page

| Mount | Source | Today |
|---|---|---|
| Composer | `MessageInput.tsx:410-420` | `onClick={onStop}`, no state |
| Workspace panel | `WorkspacePanel.tsx:453-469` | `onClick={() => void streamActions.stopThread(threadId)}`, no state |
| Active runs tray | `ActiveRunsTray.tsx:126-134` | same dispatcher; plus a `Stop all` at 2+ runs |
| Canvas run surface | — | **does not exist** (sketch 169) |

Phase 194's **D-08** already binds the runtime half — *four mounts, ONE mechanism*: every
control calls `stopThread(threadId)` and nothing reads `workflowLock?.runId` or calls
`cancelRun(` directly (`grep -cE` → **0**, held mechanically rather than by discipline).
This sketch is the display half of that same rule. If the four mounts acknowledge a press
four different ways, D-08 is satisfied and the user is still confused.

## The variants

| | Approach | Adds | Risks |
|---|---|---|---|
| **A** | **In place.** The control keeps its slot and transforms — filled square → pending ring, `Stop` → `Stopping…`, disabled. On terminal it unmounts and a terminal reading takes the slot. | One `isStopping` per mount + a timeout. No layout change. Smallest diff. | Four independent states that can disagree with each other. The pending ring is **net-new vocabulary**. |
| **B** | **The control yields.** On press the button leaves its slot and `⊘ Stopping this run…` takes it. No disabled button, because no button — a double-press is impossible by construction, not defended against. | One slot per mount that swaps its child. Re-uses the shipped `⊘`. | Layout reservation (a 32 px icon button and a text line are different widths — watch the composer). The control vanishing may read as *the run* vanishing. |
| **C** | **Surface-first.** The control merely disables; the **surface** carries the acknowledgement — the spine's active step reads *stopping*, the run's state sentence changes. The claim made is *"the run is stopping"*, not *"the button was pressed"*. | One shared reading, so all four mounts agree for free. The only variant that is honest about **what** is stopping. | Optimistic shared state written before the server confirms — against a standing project rule (*Realtime is a best-effort hint, not a source of truth — always reconcile via fetch*, D-v2.5-03). Most honest, most expensive. |

## What to look for

1. **Set the driver to “never resolves”, then press on each tab.** This is the judgement.
   A `Stopping…` that spins forever is a **new** lie and is worse than the silence it
   replaced, because the user now believes something is happening. Every variant here has a
   losing arm; compare how each one climbs down.
2. **Set the driver to “The run already finished” and press the panel Stop on the Today tab.**
   That is `BUG-260709-01`, re-opened 2026-08-16 on its own trigger. No network request,
   `document.body.innerText` byte-identical (`diffLen: 0`), and one console line stating a
   cause that is **false** — the run finished eleven minutes ago and *"press Stop again in a
   moment"* is advice that can never succeed.
3. **On tab C, press one mount and watch the other three.** They move together. In A and B
   they cannot, because each control only knows about itself. Decide whether that is worth
   what C costs.
4. **In B, watch the composer row specifically, not the panel.** The panel row has slack; the
   composer does not. If the row twitches on every stop, B owes a reserved slot.

## ⚠ Two things this sketch does NOT settle

**1. The console warning's text is a separate, smaller fix — and it is not cosmetic.**
`StreamsProvider.tsx:2453-2459` explains **three different failures** with one sentence and
is wrong for two of them. Whatever wins here, that string must stop claiming a cause it has
not established. It is ≤ 1 file and ≤ 10 lines, so under **G-3** it is `/gsd:fast` work, not
a plan — but it must be *someone's*, or it survives this phase intact.

**2. Whether the render gate change belongs in this sketch's plan or 169's.** The dead
control on a finished run is a **gate** defect (`showTimeline = isHarness || phases.length >
0` — phase rows outlive the run) and every variant above shows the fixed behaviour. But the
fix itself touches `WorkspacePanel.tsx`, which **G-5 fires on** (inherits `14 / 9 / 580`), so
the phase owes a refactor recommendation there *before* the feature. That belongs in
`194.1-CONTEXT.md` as a decision, not inside a chosen variant.

## PROVENANCE — what is shipped and what is invented

Read this before treating any pixel here as an acceptance bar. Per `SEED-155`: *a sketch
that hand-writes its own CSS is a drawing, not a contract.* This page is **hand-composed
against class strings and copy constants read verbatim from source at `045a83dc`**, not
generated from the real components.

| Region | Status |
|---|---|
| Composer Stop button — testid, aria, `Square` fill, `h-8 w-8 rounded-lg`, destructive border | **shipped verbatim** (`MessageInput.tsx:410-420`) |
| Panel Stop row — lead `"This run"`, label `"Stop"`, aria `"Stop this workflow run"`, `data-testid="panel-stop-run"` | **shipped verbatim** (`WorkspacePanel.tsx:303-306, 453-469`) |
| Tray row — pulse dot, `⏱ {elapsed} · running`, aria `Stop run on {title}` | **shipped verbatim** (`ActiveRunsTray.tsx:115-135`) |
| `⊘` as the quiet deliberate-stop mark | **shipped vocabulary** — Phase 174 D1/D2, `references/run-state-honesty.md` |
| **`Stopping…`, the pending ring, the reserved slot, the terminal reading on the panel row** | **PROPOSAL** — `grep -ri "stopping" frontend/src` returns **0** in production source. This is new copy. |

**A build must re-verify the pressed state against the real components**, in particular that
the composer's 32 px icon button can host a spinner without shifting the row.
