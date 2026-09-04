---
id: SEED-231
title: Nobody is told an approval is waiting — an unattended run pauses for a person who is never notified, and this is the collection point for every notification need
status: planted
planted: 2026-08-29
planted_by: operator, watching a 04:19 scheduled run stop silently at its approval step
surface: Agentic-RAG
severity: high
category: missing capability / notification
priority: high
scope: >
  There is NO notification system. A scheduled (unattended) run that reaches an armed
  action-risk checkpoint pauses and waits for a human decision, and nothing tells that human
  the decision is waiting. The run is not failed, not completed, and not visible to anyone who
  is not already looking at it. ⭐ THIS SEED IS ALSO THE REGISTER: every future "the user should
  be told X" belongs here until a notification system exists to own it.
affected_areas:
  - backend/app/services/scheduler_service.py
  - backend/app/services/harness_engine.py
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/workflows/WorkflowScheduleModal.tsx
relates_to:
  - SEED-164 (a workflow that legitimately pauses for a person — the publish-time half of the same tension)
  - BUG-260828-07 (approval buttons in a thread — the surface that exists once you are looking)
  - SEED-219 (stepIdentityVocabulary's six PAUSE sentences are consumed by nothing)
re_open_trigger: >
  Immediately for the DOCUMENTATION half (this file). For the BUILD: the first milestone that
  schedules anything customer-facing, or the second recorded instance of a pause nobody saw.
---

# SEED-231 — the run stopped and asked, and there was nobody in the room

## What was measured, 2026-08-29

The operator scheduled `phase 214.1 validation` for 04:19 (Asia/Dubai) to drive Phase 214 SC#2's
schedule door. It fired on time and did its work:

```
survey-library   completed
write-summary    completed
act              active      ← armed action-risk checkpoint, waiting for a person
```

`act` carries `action_risk_armed: true`, so the engine correctly stopped before sending the email
and asked for approval. **At 04:19 in the morning, of a run nobody launched by hand, on a surface
nobody had open.**

⚠ **Nothing is wrong with any single piece of this.** The checkpoint is right — an outbound
action on an unattended run is exactly what should stop. The scheduler is right — it ran what it
was told, on time. The pause is right, and it is durable. **What is missing is the sentence that
reaches a person.**

## The shape of the gap

| | today |
|---|---|
| the run pauses | ✅ correctly, and durably |
| the pause is recorded | ✅ `workflow_phases.status = active`, an ask row exists |
| a surface can render it | ✅ `PendingAskCard` — **if you are already looking at that run** |
| **anyone is told** | ⛔ **nothing. No email, no push, no badge, no digest, no inbox** |

So the failure mode is not a crash and not an error — it is **silence with a plausible face**. The
schedule list shows a run that started. The workflow looks fine. The approval sits there until it
expires, and the thing the schedule existed to do never happens.

⚠ **AND THE EXPIRY IS THE PART THAT BITES.** An unanswered `ask_user` resolves to an honest
`fail_run` (`harness_engine._resolve_failure_with_ask_user` — *"unanswered, run failed"*). So the
end state of an unattended armed run is a FAILED run whose only cause was that nobody was told to
look. That is indistinguishable, on the run list, from a run that failed on its merits.

## ⭐ THIS FILE IS THE REGISTER — add to it, do not scatter

The operator's direction, verbatim in intent: *"we did not build this notification system, but
document this, and then whatever we need notification we should add to this record."*

**So: any future finding of the form "the user should have been told X" is appended to the table
below rather than filed as its own orphan seed.** A notification need recorded in five different
places is five deferrals nobody can size; recorded here it is one capability with a growing,
evidenced specification.

| # | What must reach a person | Evidence / source | Urgency |
|---|---|---|---|
| N-1 | **An approval is waiting on an unattended run** | measured 2026-08-29, the 04:19 run above | ⛔ blocking the value of scheduling at all |
| N-2 | **That approval is about to expire** — and what happens when it does | `_resolve_failure_with_ask_user` fails the run on no answer | high — this is the silent-loss path |
| N-3 | **A scheduled run failed** | `workflow_schedules.last_status` is written and rendered nowhere a person passes | high |
| N-4 | **A scheduled run's outbound action actually sent something** | D-16's no-send line applies to golden runs ONLY; a scheduled run really sends | high — the honesty twin of N-1 |

⚠ **Rows are added with EVIDENCE, never with a guess.** A row here should name the run, the code
path or the operator observation that produced it, the way N-1 does. A speculative row makes this
register the same thing it exists to replace.

## What must be true of whatever gets built

1. **A channel that reaches a person who is not looking at the app.** In-app badges do not solve
   N-1; the whole premise is that nobody is in the app at 04:19.
2. **It must not become a second source of truth.** The notification says *go and look*; the run
   surface stays the authority. A notification that carries the decision itself would need its own
   auth story, and that is a much larger thing.
3. **⚠ It must be quiet by default about routine success.** A system that emails on every
   completed run gets muted, and a muted channel does not deliver N-1 either.
4. **The recipient is a real question, not an obvious one.** The run owner is the default; an org
   with several people who could approve is a different design, and it should not be assumed here.

## What it must NOT become

An excuse to weaken the checkpoint. **Auto-approving an unattended run because nobody was told is
the wrong repair** — the checkpoint is the one thing in this story that behaved correctly. The
answer is to tell somebody, or to let an author choose that a given schedule may not contain an
armed step, never to make the arm mean less.
