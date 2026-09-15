---
seed_id: SEED-231
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
status_note: >
  ⚠ STILL `planted`, DELIBERATELY. Phase 235 shipped the SURFACE this seed needs and registered
  exactly ONE producer (a broken source) — nothing about this seed's own notification need shipped,
  so flipping to `folded` or `closed` would be a lie the register would then carry forever. What
  changed is the COST: answering N-1 is now "register a producer", not "design a surface".
last_reviewed: 2026-09-06
reviewed_at_phase: 235 (plan 235-12, the phase close)
seam: >
  frontend/src/components/layout/attentionConditions.ts — its `ATTENTION_PRODUCERS` array is the
  registration point. ⛔ Phase 235 registered exactly one producer and forbade a second inside
  itself; `NavPanel.badge.test.tsx` asserts `ATTENTION_PRODUCERS.length === 1` LITERALLY, so the
  next author adding a tenant must come to that file and argue with a number. That is the seam
  working, not an obstacle: a deliberate registration is the intended way past it.
deferred_options:
  - id: D-235-02 option C — email on permanent failure (SURF-03)
    status: DEFERRED, not dropped
    reason: >
      There is no app-owned mailer in this product. The SMTP path is a USER's connection, not ours,
      so an "email the owner" producer has no sender it may legitimately use.
    trigger_when: >
      EITHER a customer reports learning about a dead watch from a stale answer, OR the product
      gains an app-owned mailer for any other reason (this seed's own approval notifications being
      the likeliest cause). Two INDEPENDENT triggers, so the deferral cannot be orphaned by
      whichever arrives first.
trigger_when: unset
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

---

## 2026-09-06 — Phase 235 built the surface this seed has been waiting for (one tenant, not this one)

Phase 235's `discuss-phase` (`.planning/phases/235-the-source-says-what-it-did/235-CONTEXT.md`)
resolved `SURF-03` — *"a broken watch reaches a person who is not already looking at the page"* —
and deliberately built the **general** app-shell notification surface rather than a watch-specific
badge, **registering exactly one producer**: a broken source (`D-235-03`).

⚠ **This seed is NOT closed and nothing about it shipped.** What changed is that the surface it
needs now exists, so wiring the pending-approval producer is a registration, not a new surface.

- **⭐ THE SEAM, NAMED BY FILE AND BY SYMBOL so nobody has to go looking:**
  **`frontend/src/components/layout/attentionConditions.ts`**, and specifically its
  **`ATTENTION_PRODUCERS`** array. That module's own docblock records the intent verbatim: *"The
  seam exists so `SEED-231` (nobody is told an approval is waiting) can plug in later **without a
  second surface** growing beside this one."* It is fed by a server-computed verdict endpoint
  (`D-235-05`), rendered as a badge on the nav rail with a popover (`D-235-04`), and consumed in
  exactly one place — `ChatLayout` reads the registry ONCE and hands the result to three renderers.
- ⛔ **The one-tenant rule is ENFORCED, not requested.** `NavPanel.badge.test.tsx` asserts
  `ATTENTION_PRODUCERS.length === 1` **literally**, so the next author adding a tenant has to come
  to that file and argue with a number. **That constraint is FOR this seed, not against it** — it
  exists to stop an unrelated phase quietly acquiring the slot. Wiring N-1 is a deliberate
  registration, and re-baselining that assertion in the same commit is the intended way past it.
- ⛔ Phase 235 explicitly forbade registering a second producer inside itself — that was named as
  scope creep, not deferred by accident.
- ⚠ **What a producer must NOT do here:** `attentionConditions.ts` derives no verdict. It shapes a
  server answer into conditions and filters, re-counts and second-guesses nothing (`D-235-05`). An
  approval producer must therefore bring its own server-side "is an approval waiting" answer — a
  client-side scan of run rows would be the second-source-of-truth this seed's own rule 2 forbids.
- **Re-open trigger for the BUILD half of this seed, unchanged:** the first milestone that schedules
  anything customer-facing, or the second recorded instance of a pause nobody saw. **What is new is
  that the cost of answering it has dropped from "design a notification surface" to "register a
  producer."**

### It also now carries `SURF-03`'s option-C deferral

Phase 235 offered three cost-ordered homes for `SURF-03`; **option C — email on permanent failure —
was DEFERRED, not dropped** (`D-235-02`), because there is **no system mailer** in this product (the
SMTP path is a *user's* connection, not ours). Its named re-open trigger is recorded here because
this file is the register:

> **Option C re-opens when EITHER** a customer reports learning about a dead watch from a stale
> answer, **OR** the product gains an app-owned mailer for any other reason — this seed's own
> approval notifications being the likeliest cause.

Two independent triggers, so it cannot be orphaned by whichever arrives first.
