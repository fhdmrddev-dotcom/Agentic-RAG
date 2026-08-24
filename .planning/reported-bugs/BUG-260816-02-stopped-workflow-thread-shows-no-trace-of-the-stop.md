---
id: BUG-260816-02
title: A stopped workflow thread shows no trace of the stop — navigating back shows only the original prompt
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: folded   # 2026-08-16 — folded into Phase 194.1 at discuss-phase. Claimed WHOLE by R4:
                 # the run-anchored line derives from the new workflow_runs-by-thread read, so it
                 # is present on FIRST PAINT after navigation, not only while streaming.
affected_areas: [frontend/chat-display, frontend/streaming, frontend/run-honesty, harness/workflow-ui]
folded_into: "194.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 045a83dc
  date: 2026-08-16
---

# BUG-260816-02: A stopped workflow thread shows no trace of the stop

Operator report during Phase 194 UAT (2026-08-16), verbatim:

> *"if the workflow is stopped, if I navigate back to the thread of this workflow that was — there is
> nothing showing that this workflow is stopped, it's only showing the original prompt."*

## What we observed

1. Launch a workflow run, let it reach a mid phase, press **Stop**. The stop lands correctly — Phase
   194 UAT verified the durable state on seven live runs: `workflow_runs.status = 'cancelled'`, the
   interrupted `workflow_phases` row `= 'cancelled'`, completed phases untouched,
   `threads.active_workflow_run_id = NULL`, producer `runs` row `= 'cancelled'`.
2. Navigate away and back into that workflow's chat thread.
3. **Actual:** the thread shows the original kickoff prompt and nothing that says the run was
   stopped. Nothing distinguishes it from a run that was never started, or one that finished.
4. **Expected:** the thread carries a durable, legible mark that this run was **stopped by the user**
   — the same honesty the phase spine shows after a reload (`act ■ Stopped`).

### Related, separately observed in the same session — the LIVE surface is also wrong

Phase 194 UAT row **UAT-02** (G-3), driven on an armed-approval run:

| Time after Stop | Live surface (no reload) |
|---|---|
| +5 s | approval card **"Approve this step / Do not run it"** still rendered; spine `act ● Running`; badge `Working` |
| +13 s | **unchanged** — the word "Stopped" appears **nowhere** on the surface while Postgres reads `cancelled` |
| after reload | ✅ correct — `act ■ Stopped`, `Phase 2 of 3, act, stopped`, approval card gone |

So there are **two** faces of the same honesty gap:

- **Live:** for as long as you stay on the page, a cancelled run renders as **Running**, and (at an
  approval) offers an actionable card that can never be honoured — a zombie approval.
- **On return:** once you leave and come back, the *"this was stopped"* signal is gone entirely.

The stored truth is right in both cases. **Only the display is wrong, in opposite directions.**

## Why it matters

`major`. RUN-01 is *"a user can stop a running workflow at any point, and the run reports honestly
that it was stopped."* The database reports it honestly; **the screen does not, at either of the two
moments a user actually looks.** A user who stops a run and comes back later cannot tell whether it
was stopped, whether it failed, or whether they imagined pressing the button — which is precisely the
confusion Phase 194 exists to remove.

The zombie approval card is the sharper half: it invites an action that will silently go nowhere.

## Hypothesized cause

Hypothesis, not finding — and note this is very likely the **same root cause** as the already-filed
`BUG-260710-01` (*"Stopped" indicator on a cancelled message disappears after navigating away and
back*, reported 2026-07-10, folded into 174, never verified closed). That report's own hypothesis:

> The "stopped" affordance is live-only frontend state tied to the streaming lifecycle. On reload the
> message is reconstructed from persisted `messages` rows, and the cancelled flag lives on the `runs`
> row (`runs.status='cancelled'`), not on the message. The message renderer does not derive/show a
> persistent "cancelled" badge from the run status.

⚠ **This report is the WORKFLOW-thread instance of that same family, and it is filed separately
rather than merged for one measured reason: `BUG-260710-01` is about a Deep chat MESSAGE losing its
badge, and this is about a HARNESS run whose thread carries a phase spine, a run receipt and a
kickoff prompt — a different renderer with a different source of truth** (`workflow_runs` +
`workflow_phases`, not `runs`). A fix to one does not automatically fix the other. They should be
looked at together and closed together if the fix turns out to be shared.

For the live half: the cancel terminal appears not to clear the pending `ask_user` / approval card
nor flip the live phase reading; only the reload path (which re-reads `workflow_phases`) is correct.

## Surface classification

`Agentic-RAG` — this app's own frontend rendering of its own durable state. Cross-checked at
`/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 194 is executed and verified `gaps_found`.
- **Defer to future phase / milestone:** yes — same phase as `BUG-260816-01` and `194-UAT.md`
  UAT-01/UAT-02. One story: *"the Stop is reachable, it acknowledges you, and it tells the truth —
  live and on return."*
- **Plant as seed:** n/a.
- **External — note only:** no.

⚠ **G-2 fires** — this is run-honesty display vocabulary (badge, label, what a stopped run looks like
on return). `/gsd:sketch` before spec/discuss.

⚠ **Check `BUG-260710-01` in the same breath.** Its frontmatter says `status: folded, folded_into:
"174"` with `verified_closed_by: null` — it was never verified closed, and the family still
reproduces two months later on an adjacent surface.

## Workarounds (prompt-side, code-side, or UI-side)

- **Reload the page** after stopping a run — the reloaded surface is correct (`act ■ Stopped`,
  approval card gone). This is the reliable way to see the truth today.
- To confirm ground truth without the UI: `workflow_runs.status`, `workflow_phases.status` and
  `threads.active_workflow_run_id` are authoritative and were correct on all seven runs driven.

## Reference / evidence links

- `.planning/phases/194-stop-a-running-workflow/194-UAT.md` § *DRIVEN RESULTS* — **UAT-02**
- `.planning/reported-bugs/cancelled-run-stop-indicator-lost-on-navigation.md` — `BUG-260710-01`,
  the Deep-chat sibling of this bug
- `.planning/reported-bugs/killed-workflow-empty-chat-card.md` — adjacent symptom family
- `.planning/reported-bugs/cancelled-run-empty-bubble-early-cancel.md` — adjacent symptom family
