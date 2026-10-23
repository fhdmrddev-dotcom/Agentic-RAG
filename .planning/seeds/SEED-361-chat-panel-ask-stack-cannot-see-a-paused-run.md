---
seed_id: SEED-361
title: The chat panel's PendingAskStack cannot tell a paused workflow run, so its card stays countdown-driven ("agent stopped") while the run page offers the answer
created: 2026-10-19
surface: Agentic-RAG
status: folded
partial: false
status_note: "LIVE-VERIFIED 2026-10-21 (gap round 1 re-drive, run b5678cc3 on 128266ef6): the chat panel card on a paused found-nothing ask reads NEEDS YOU with three worded choices and is answerable; the armed approval card too (9cb788d0). New, separate defects in the same home are D-r1-01 and D-r1-02 (295-VALIDATION.md). FOLDED INTO 295 by gap round 1 (295-08, 2026-10-21): RED 14ffe7c2f, GREEN a2866c3ea. reconcilePhases records run_status in ONE store field (workflowRunStatusByThread); PendingAskStack derives paused and runIsOver is false while the run is paused; paused is passed to the card. Owed before closed: the live re-drive of 295-VALIDATION.md S1 in the chat panel after merge. Earlier note: TRIGGER FIRED IN PHASE 295 and was not routed at discuss: 295-05 and 295-06 named StreamsProvider.tsx and PendingAskCard.tsx. Measured live by 295-07 (2026-10-21): since 295-03 made every engine ask a durable pause, the chat panel card for a paused found-nothing or approval ask reads RETIRED 'The run was stopped, so this question no longer needs an answer' with Send disabled (runs 3ec118a2, 108bb381). Cause: PendingAskCard.tsx:897 derives runIsOver = workflowLock == null && phases.length > 0, and the client seeds the lock only when locked && !lock_is_stale (StreamsProvider.tsx:2536, ChatArea.tsx:380); a durable pause has no live producer, so lock_is_stale is true. Proposed: /gsd:fast with a RED test (one derived conjunct reading run_status paused / cap_paused). 295-VALIDATION.md S1."
trigger_when: "The next phase whose files_modified names frontend/src/providers/StreamsProvider.tsx or frontend/src/stores/streamsStore.ts; or any report that a paused workflow run's chat-panel card says 'agent stopped'."
trigger_paths: ["frontend/src/providers/StreamsProvider.tsx", "frontend/src/stores/streamsStore.ts", "frontend/src/components/panel/PendingAskCard.tsx"]
trigger_surfaces: ["panel", "workflow"]
migration_note:
relates_to: ["SEED-360", ".planning/phases/289-the-run-page-and-its-evidence/289-01-SUMMARY.md (## Named gap: PendingAskStack)", ".planning/phases/289-the-run-page-and-its-evidence/289-VALIDATION.md"]
folded_into: "295"
renumbered_from: null
renumbered_because: null
---

# SEED-361: the chat panel's ask card cannot see that a run is paused

## The finding

Phase 289 (D-13) gave `PendingAskCard` a `paused` prop: on a paused run the card keeps its answer
control after the window and says "The answer window has passed. The run is paused and still
waiting for your answer." `WorkflowRunPage` passes it (`paused={runStatus === "paused"}`), and the
live drive proved it (289-05 S5: answered from the run page card, the run completed in ~4 s).

The chat panel's `PendingAskStack` mounts the same card but has no run status to pass, so for a
paused workflow run it still counts down and then reads "No response within 0:30 — agent stopped",
with no answer control. Read from the code at 289-01 HEAD (not assumed):

- The stack's only run signals are `useWorkflowLockForThread(threadId)` and `usePhases(threadId)`
  (`PendingAskCard.tsx:857-858`).
- `WorkflowLock` carries `runId`, `mode`, `capPaused`, `continuesRemaining` and **no run status**
  (`streamsStore.ts:98-144`); `capPaused` is the iteration-cap pause, not the human-gate `paused`.
- `reconcilePhases` fetches `getThreadWorkflow`, whose wire DOES carry `run_status`
  (`lib/api/threads.ts:1546`, `models/thread.py:440`), but returns only `Phase[]` and discards it
  (`StreamsProvider.tsx:4640-4641`).
- A paused run's human-input step stays DB `active`, which maps to `running` (`phaseState.ts:61`).

## What would close it

Carry `run_status` from the `getThreadWorkflow` read the provider already makes into the store (one
field), and pass `paused` from the stack. Both files are G-5 FIRING (`StreamsProvider.tsx` 109/42/5004),
so this is a one-field passthrough or it waits for that file's extraction; never a new fetch in the
stack.

## Live-verified (2026-10-21, gap round 1 re-drive)

Driven on develop `128266ef6` (295-08 merged) against the operator's `:8000` and vite. Record: `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md` → "Gap round 1 re-drive (2026-10-21)".

- **Found-nothing pause, run `b5678cc3`.** The Workspace panel card reads `NEEDS YOU` with "No deadline — the run is waiting for your answer and will not continue on its own" and three worded choices. The word Retired does not appear. Send is enabled once a choice is made.
- **Search another folder.** It lists the server's folders, and Send stays disabled until one is picked. The answer resumed the run, and it completed cited.
- **Chat column.** With the panel closed, the full card is in the chat column. With the panel open, the chat column shows the one-line pointer.
- **Armed approval, run `9cb788d0`.** The card is answerable in the panel too.

The seed's defect, a paused run read as over, is gone in the chat panel. Two new, separate defects were found in the same home:
- **D-r1-01:** a stale card's 409 says "This run has already ended".
- **D-r1-02:** after an answer, the thread stops following the run.

Neither is this seed's cause. Status is left `folded`: the closing call belongs to the phase verifier.
