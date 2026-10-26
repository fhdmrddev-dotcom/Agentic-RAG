---
seed_id: SEED-367
title: An open chat thread does not see a workflow run that another tab or the API started, until a thread switch
created: 2026-10-21
surface: Agentic-RAG
status: planted
partial: false
status_note: "ROUTED by Phase 296 (2026-10-27): inventory row DEBT-1 / 293-F-2 (an unattended run that pauses never expires and can only be answered in the app; no ThreadRunLine for a live key or schedule run) was routed HERE rather than fixed, because it is a capability (Realtime or polling for runs), and 296 D-03 forbids capability in a debt close-out. Stays planted for v4.8."
trigger_when: "A phase adds Realtime or polling for runs or asks; or a phase whose files_modified names frontend/src/providers/StreamsProvider.tsx and touches how a thread attaches to a run; or a report that a paused run's card did not appear in an open thread."
trigger_paths: ["frontend/src/providers/StreamsProvider.tsx", "frontend/src/stores/streamsStore.ts", "frontend/src/components/panel/PendingAskCard.tsx"]
trigger_surfaces: ["panel", "workflow"]
migration_note:
relates_to: [".planning/phases/295-runs-that-don-t-dead-end/295-10-SUMMARY.md", ".planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md", "SEED-361"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-367: an open thread does not see a run it did not start

## The finding

Measured live twice in Phase 295 (run `603a0785` and the round 1 re-drive). A run was started through the API (not from this tab) while its chat thread was open. When the run paused for an answer, the panel read "No workspace activity yet" for 155–200 s. The card appeared only after a thread switch.

Nothing tells the open tab: there is no Realtime on `runs` or messages, and the focus reconcile does not re-read phases or asks. A run this tab started, and a run re-driven after an answer in this tab, are both followed (fix 295-10).

## Why it matters

A scheduled run, or one started from the run page in another tab, can wait on a person who is looking at its thread and sees nothing. The person has to know to switch threads.

## When to surface

Any phase that adds Realtime or polling for runs or asks, or changes how a thread attaches to a run in `StreamsProvider.tsx`; or any report that a paused run's card did not appear in an open thread.

## Scope estimate

Small to medium. A bounded poll of `GET /threads/{id}/workflow` while a thread is open, or a Realtime hint on `workflow_runs` that triggers the existing reconcile (Realtime is a hint, never truth: D-v2.5-03). It is a new capability, so it needs its own phase, not a gap round.
