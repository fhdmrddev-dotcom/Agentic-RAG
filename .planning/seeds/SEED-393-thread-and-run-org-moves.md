---
seed_id: SEED-393
title: Chats and runs cannot move to another organization
created: 2026-10-28
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: A person in two or more organizations reports a chat or a run sitting in the wrong organization, or any phase whose files_modified names org_move.py or threads.py and gives threads an org write.
trigger_paths: ["backend/app/services/org_move.py", "backend/app/api/threads.py"]
trigger_surfaces: ["chat", "workflow"]
migration_note:
relates_to: ["backend/app/services/org_move.py", "backend/app/api/org_items.py", "298-03", "D-19", "D-31", "298-ORG-AUDIT.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-393: Chats and runs cannot move to another organization

## The finding

Phase 298 (plan 298-03) added a per-item move to another organization the owner belongs to
(`backend/app/services/org_move.py`, `POST /org-items/move`). It moves three kinds of item: a
Library folder with its subtree, a Root document with its versions, and a draft workflow.
Chats (threads) and workflow runs are **not** movable (D-19). They are counted in the
"N more in <org> · Switch" line (`GET /org-items/elsewhere`), and the only way to reach one in
another org is to switch to that org.

The reason is size, not difficulty of principle. A thread drags its messages, its runs, its
workspace files and artifacts, its sandbox session and any bound folder with it. A run belongs to
a thread and to a definition, and the run's org is the org its runner was in when it started
(298-ORG-AUDIT.md measured that as normal, not a mis-stamp).

## Why it matters

Nobody yet. The 298 audit measured **0** multi-org users in the cloud, and the local mis-stamps
were deliberate fixtures. A `LIMIT 1` mis-stamp (mig 106) always lands in a real membership, so
the owner can still reach the chat by switching. The cost appears only when a multi-org person
genuinely wants a chat to live in the other org, for example to share it with that org's members.

## When to surface

Any of:
- a multi-org person reports a chat or a run in the wrong organization;
- a phase gives threads an org write (any `UPDATE threads SET org_id`), or names
  `backend/app/services/org_move.py` or `backend/app/api/threads.py` in `files_modified` for an
  org-related reason.

## Scope estimate

Large. It needs a disposition for every org-stamped table under a thread (messages, runs, phases,
harness audit, workspace files, artifacts, citations) and a decision about runs whose definition
stays behind. It also needs the same one-transaction, both-org-membership and in-transaction
audit discipline that `org_move.py` applies (D-35).

## Breadcrumbs

- 298-CONTEXT.md `<deferred>`: "Thread and run moves across orgs … new seed at plan time".
- D-19 (movable kinds), D-31 (published workflows descoped, SEED-394), D-35 (one pool transaction).
- `org_move.py` docstring names this exclusion; `REFUSAL_ORDER` has no thread/run kind.
