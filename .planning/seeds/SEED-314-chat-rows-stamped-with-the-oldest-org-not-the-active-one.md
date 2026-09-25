---
seed_id: SEED-314
title: A two-org user's chat in org B writes its thread, messages and run under org A — retrieval honours X-Org-Id, the row stamps do not
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching chat thread/run creation, run metering or usage attribution, the autofill_org_id_by_owner trigger, or multi-org membership.
trigger_paths: ["backend/app/api/threads.py", "backend/app/db/runs.py", "backend/app/services/run_producer.py", "supabase/migrations/*autofill*"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "SEED-313", "266-05 SC#4-flip", "migration 106"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-314: chat rows are stamped with the oldest org, not the active one

## The finding

Measured live in Phase 266-05 (row SC#4-flip, `266-UAT-LOG.md`). User U1 is org-admin of org A and was
added (local SQL) as a member of org B. With `X-Org-Id: B` on every request, U1 created a thread, set the
Financial Analyzer active and asked the revenue question. **Retrieval was correct:** the `search.query`
audit row's only document id joins to `documents.org_id = B`. **The rows the turn wrote were not:**

| row | org_id |
|---|---|
| `threads` `3bbde354-…` | **A** (`0eb0cb6d-…`) |
| `messages` (user + assistant) | **A** |
| `runs` `c350e0aa-…` | **A** |

`threads` and `runs` carry `BEFORE INSERT` triggers `autofill_org_id_by_owner('user_id')` (migration 106),
which resolve `SELECT org_id FROM org_members WHERE user_id = … LIMIT 1` with no ORDER BY. `send_message`
stamps the validated active org onto `current_user` (threads.py ~:947) and the producer's retrieval and
Expert resolution read it, but the INSERTs omit `org_id`, so the trigger guesses.

This is SEED-313's class (the `/upload` twin) on the chat surface.

## Why it matters

- **Metering and usage attribution** read `runs.org_id`. A two-org user's work in org B is billed and
  counted to org A (Phase 256's METER work reads these totals).
- **Org-scoped reads of history** (`list_threads` with an org predicate, admin audits, retention) see B's
  conversation in A, and not in B.
- Single-org users are unaffected, which is why nothing has reported it. The operator's dev account IS
  two-org.

## When to surface

Any phase whose `files_modified` names `backend/app/api/threads.py`, `backend/app/db/runs.py`,
`backend/app/services/run_producer.py` or an `autofill_org_id` migration; any metering / usage-by-org
work; any report of a chat or run appearing under the wrong organisation.

## Scope estimate

Medium. Pass the already-validated active org explicitly into the thread insert, the message inserts
and `insert_run`, pinned by a two-org test that reads the rows back. ⚠ `run_producer.py` FIRES G-5 and
was held byte-unchanged by Phase 266 (D-266-11), so the fix belongs to a phase that owns that file.

## Evidence — Phase 267 live UAT (2026-09-26, local)

Measured again, and NOT a 267 regression (267 finding F-3). U2 `uat267-u2-7ef2ae@example.test` belongs to its personal org C `e3c47417-…` (the `LIMIT 1` trigger pick) and to org A `e8c567c2-…` (member). Driving with `X-Org-Id` = A: the threads, the `expert_changed` row and all three handoff rows are org **A** — 267 sets `org_id` explicitly (D-267-34). But every `runs` row (`13e55d14-…`, `bfbc1682-…`) and every user/assistant `messages` row on those threads is org **C**. The send path still relies on the trigger. Evidence: `.planning/phases/267-an-expert-adds-scope/evidence/05b-f3-send-path-org.txt`; the explicit-org pattern that fixes it is proven under real RLS by `backend/tests/integration/test_267_transcript_rows_rls.py`.
