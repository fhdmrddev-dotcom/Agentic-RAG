---
seed_id: SEED-396
title: The messages INSERT policy does not check thread ownership or origin — a signed-in user can write system/harness rows into any thread of their org
created: 2026-10-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase that edits the messages table's RLS policies, the answer route, or anything that trusts a role='system' / origin='harness' messages row (Phase 301 reads notices written from such rows).
trigger_paths: ["supabase/migrations/*messages*", "backend/app/api/runs.py", "backend/app/services/harness/engine_ask.py", "backend/app/services/harness/human_input.py", "supabase/migrations/218_run_waiting_notifications.sql"]
trigger_surfaces: []
migration_note:
relates_to: ["Phase 300 (300-SECURITY.md UF-1)", "Phase 301 (the waiting-on-you list reads notifications)", "supabase/full-schema.sql policy \"Users can insert their own messages\""]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-396: The messages INSERT policy does not check thread ownership or origin

## The finding

`"Users can insert their own messages"` (`supabase/full-schema.sql`, the `messages` INSERT policy) checks
`user_id = auth.uid()` and the caller's org only. It does not check that the caller owns `thread_id`, and it
does not restrict `role` / `origin`. So any signed-in user can, through PostgREST with their own JWT,
insert a `role='system'`, `origin='harness'` row carrying a forged `tool_calls` payload into **any thread
of an org they belong to**, if they know its UUID.

Phase 300 found this as UF-1 (`300-SECURITY.md`) because migration 218's SECURITY DEFINER trigger
`notify_on_ask_row()` reacts to such rows. 300 closed the cross-thread variants inside the trigger
(2026-10-29): a prompt row only writes a notice for a run in the row's own thread (UF-1 fix), and an
answer row only closes notices of runs in its own thread (300-REVIEW WR-04). **What stays open is the
same-org, known-thread-UUID variant:** a member who knows a colleague's thread UUID and run UUID can still
write a forged prompt or answer row INTO that thread, and so create, re-point or close the colleague's
notice (and trigger or suppress the run-waiting email). The email content stays fixed and nothing is
disclosed to the attacker. The policy gap predates Phase 300.

## Why it matters

Any feature that trusts a system/harness row in a thread (approvals, ask answers, notices, run receipts)
inherits this. Today the impact is bounded (UUIDs are random, same org required, no disclosure), so this
is low severity, but it is a structural trust gap, not a one-off.

## Suggested shape

Tighten the INSERT policy so a user-JWT insert must own the thread (`thread_id IN (SELECT id FROM threads
WHERE user_id = auth.uid())`) and may not write `role='system'` / `origin='harness'` rows — those are
written by the service role. Check first which client paths legitimately insert system rows with a user
JWT (the answer route in `backend/app/api/runs.py` and the engine paths) and move them to the service
role if needed. Ship it as a numbered migration with an anon/other-user live test.
