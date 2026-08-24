---
id: BUG-260816-01
title: The Stop controls give no feedback that a stop is happening, and the canvas run surface has no Stop control at all
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: folded   # 2026-08-16 — folded into Phase 194.1 at discuss-phase. Claimed WHOLE:
                 # the pressed state (R1) + the 8s climb-down (R2) cover "no feedback" on all
                 # four mounts; R3 mounts the missing Stop in WorkflowRunPage.tsx's title row.
affected_areas: [frontend/chat-display, frontend/streaming, harness/workflow-ui, workflow/run-surface]
folded_into: "194.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 045a83dc
  date: 2026-08-16
---

# BUG-260816-01: Stop gives no feedback, and the canvas run surface has no Stop at all

Operator report during Phase 194 UAT (2026-08-16), while watching live workflow runs being
stopped. Three related complaints about the *same* thing: **a Stop press produces no visible
acknowledgement anywhere.** They are filed together because they share one fix conversation, and
split out below so each can be closed independently.

## What we observed

### (a) The composer Stop button has no pressed / stopping state

Operator, verbatim: *"when we open the workflow in the chat and you click button in the chat box it
is not showing a loader, not showing the user that it is stopping the request, which is a little bit
confusing."*

**Confirmed in source**, `frontend/src/components/chat/MessageInput.tsx:410-420`:

```tsx
{disabled ? (
  <Button onClick={onStop} size="icon" variant="outline"
          aria-label="Stop generation" data-testid="composer-stop" …>
    <Square className="h-3.5 w-3.5 fill-current" />
  </Button>
) : ( … Send … )}
```

There is **no `isStopping` state, no spinner, no disabled-after-click, no label change.** The button
renders identically before and after the click. The only thing that ever changes it is `disabled`
flipping false when the whole stream teardown completes — which swaps it back to Send.

⇒ Between the click and the teardown the user has **no way to tell** whether the click registered,
whether the stop is in flight, or whether nothing happened at all.

### (b) The workspace-panel Stop never changes state either — including after the run has stopped

Operator, verbatim: *"there's a stop button in the workspace area which always stays as it is, not
triggered, also for showing that the run is stopped."*

Two distinct problems in one control:

1. Same as (a) — no pressed/pending affordance on click.
2. **The control still renders after the run is terminal.** `WorkspacePanel.tsx:453` gates on
   `showTimeline = isHarness || phases.length > 0`, and phase rows outlive the run, so a finished
   run still shows **"THIS RUN — Stop"**.

**Driven in Phase 194 UAT (UAT-03)** on a completed run: pressing it produced **no network request**,
`document.body.innerText` was **byte-identical** before and after (`diffLen: 0`), and the only
evidence anywhere was a console warning that states a **false** cause:

```
Stop did nothing: no run id yet for thread ae2f654b-… — the run had not finished
registering (the pre-stamp window). Nothing was cancelled; press Stop again in a moment.
```

The run was **finished**, not "not yet registering", and "press Stop again in a moment" is advice
that can never succeed.

### (c) The canvas run surface has NO Stop control at all

Operator, verbatim: *"there is no stop button in the canvas, I think this is needed."*

**Confirmed in source** — at `045a83dc`:

```bash
grep -c "stopThread\|cancelRun\|Stop" frontend/src/pages/WorkflowRunPage.tsx
# → 0
```

**Zero.** `WorkflowRunPage.tsx` is the surface the user is sent to immediately after pressing
**▶ Run workflow** (the RunModal says so: *"Run opens this workflow's run surface"*). It renders the
live canvas, the elapsed timer, the run band and the deliverables — and offers **no way to stop the
run it is displaying.**

## Why it matters

**Severity `major`, and (c) is the reason.** Phase 194's requirement RUN-01 is *"A user can stop a
running workflow at any point, and the run reports honestly that it was stopped."* Taken together
with Phase 194's `UAT-01` (see `194-UAT.md`), the natural launch path has **no working Stop**:

| Step in the natural flow | Stop available? |
|---|---|
| Press **▶ Run workflow** → land on the canvas run surface | ❌ **no control exists** (c) |
| Switch to another thread, use `ActiveRunsTray` | ❌ **silent no-op** unless the run's thread was opened this session (`194-UAT.md` UAT-01) |
| Click **"Open the chat thread"**, then panel/composer Stop | ✅ works — but gives no feedback (a)/(b) |

So the only Stop that works is the one the user has to navigate to, and it is also the one that
never acknowledges the press. **The honesty requirement is undermined by silence at both ends: the
control does not say it heard you, and (per UAT-01) sometimes it genuinely did not.**

(a) and (b) are individually `minor` ergonomics; they are filed at `major` because they are what
makes UAT-01 *invisible* — a Stop that silently does nothing is indistinguishable from a Stop that
is working but slow, precisely because there is no pending state to distinguish them.

## Hypothesized cause

Hypothesis, not finding:

- (a)/(b) — the Stop controls are pure dispatchers (`onClick={onStop}` / `onClick={() => void
  streamActions.stopThread(threadId)}`). Neither awaits the promise nor holds local state, so there
  is nothing to render a pending style from. `stopThread` is `async` and does `await cancelRun(runId)`
  but returns nothing the button observes.
- (b) part 2 — the render gate is derived from *phase rows*, which are durable, rather than from
  *run liveness*. A gate on the run's terminal status would remove the control instead of leaving a
  destructive-looking affordance that does nothing.
- (c) — the run surface was built as a **read-only** view (it renders `👁 View only` and *"the plane
  pans · steps stay put"*). The Stop mounts were scoped in Phase 194 as panel / composer / tray, and
  the canvas was never one of them. This looks like a scoping gap rather than a regression.

## Surface classification

`Agentic-RAG` — all three are this app's own frontend. Cross-checked at `/gsd:discuss-phase`,
`/gsd:new-milestone`, `/gsd:complete-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 194 is executed and verified `gaps_found`; per **G-7**
  a gap-closure round may not add a new user-facing capability, and (c) is a **new control on a new
  surface**, i.e. exactly that.
- **Defer to future phase / milestone:** yes — the same phase that fixes `194-UAT.md` **UAT-01**.
  All four defects are one story: *"the Stop is reachable, it acknowledges you, and it tells the
  truth."*
- **Plant as seed:** n/a — it has a concrete home (the UAT-01 fix phase).
- **External — note only:** no.

⚠ **G-2 fires on (a) and (b):** both are *"live UI, badge, label, animation, feels-like"* scope, so
`/gsd:sketch` comes **before** `/gsd:spec-phase` or `/gsd:discuss-phase`. What a Stop looks like
while it is stopping is a design decision, not an implementation detail.

⚠ **(b) part 2 is already recorded as Phase 194 review finding WR-03 and verification Anti-Pattern
A-2, both open and unfixed.** This report adds the *driven* evidence and the false-warn-text half.

## Workarounds (prompt-side, code-side, or UI-side)

- To stop a workflow run today: from the canvas run surface click **"Open the chat thread"** first,
  then use the panel Stop (`THIS RUN — Stop`) or the composer Stop. Both work.
- After pressing Stop, **reload the page** to see the true state — the live surface does not update
  reliably (see `BUG-260816-02`).
- Do **not** rely on the `ActiveRunsTray` Stop for a run whose thread you have not opened in the
  current page session — it silently does nothing (`194-UAT.md` UAT-01).

## Reference / evidence links

- `.planning/phases/194-stop-a-running-workflow/194-UAT.md` § *DRIVEN RESULTS* — UAT-01, UAT-03
- `.planning/phases/194-stop-a-running-workflow/194-VERIFICATION.md` — Anti-Pattern A-2 (WR-03)
- `.planning/phases/194-stop-a-running-workflow/194-REVIEW.md` — WR-03
- `frontend/src/components/chat/MessageInput.tsx:410-420` — composer Stop, no pending state
- `frontend/src/components/panel/WorkspacePanel.tsx:453-469` — panel Stop, gate + dispatch
- `frontend/src/pages/WorkflowRunPage.tsx` — **zero** Stop references at `045a83dc`
- `frontend/src/providers/StreamsProvider.tsx:2453-2459` — the false warn text
