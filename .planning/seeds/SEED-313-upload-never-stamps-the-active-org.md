---
seed_id: SEED-313
title: /upload never stamps the caller's active org — a two-org user's upload lands in an arbitrary org
created: 2026-09-24
surface: Agentic-RAG
status: answered
partial: true
status_note: |
  2026-10-30 (298 close): 298 PASSED — all 8 G-4/A-1 rows driven live (298-VALIDATION.md). The Root-upload arm (298-01 Task 2) shipped; flipped partially-answered -> answered. Previous line: `status: partially-answered`.
  2026-10-30 (302 REG-08): 298 is human_needed — G-4 owed (298-HUMAN-UAT.md: G4-1 Library switch first;
  G4-5 for the "N more … in {org}" count; G4-6 / G4-7 for the move; 0 of 8 rows run). The no-folder arm is
  fixed in code (298 D-07); not closed ahead of it. Status unchanged.
  Phase 298 discuss (2026-10-28) FOLDS the open no-folder arm: a Root upload stamps the active org (298 D-07),
  because 298 narrows Root documents by org. Status stays partially-answered until 298 ships.
  Moved `planted` -> `partially-answered` on 2026-10-14 (Phase 280 plan 04). Original line: `status: planted`.
  AXIS SETTLED (folder arm): 280-03 D-26 (`8f83c307e`, BUG-261014-01) - a /upload INTO A FOLDER now mints in that
  folder's org (membership checked; otherwise the identical 404), so a two-org user's foldered upload no longer
  lands in the trigger's LIMIT 1 org. Proven live by test_280_cr01_two_org_live.py.
  AXIS OPEN (no-folder arm): a /upload with no folder still passes org_id=None and lands in
  autofill_org_id_by_owner's LIMIT 1 org. The caller's active org (X-Org-Id) is still not stamped.
  Previous note, verbatim: Phase 270 (2026-09-30) touched the trigger path and left this open: the phase adds a
  download route and a file-facts write, and changes neither upload org-stamping nor versioning.
trigger_when: Any phase touching backend/app/api/documents.py upload, the autofill_org_id trigger, or multi-org membership.
trigger_paths: ["backend/app/api/documents.py", "backend/app/dependencies.py", "supabase/migrations/*autofill*"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "RESEARCH C-8", "D-266-18"]
folded_into: "298"
renumbered_from: null
renumbered_because: null
---

# SEED-313: /upload never stamps the caller's active org

## The finding

`POST /documents/upload` reads the org from `current_user.get("org_id")` (`backend/app/api/documents.py:674`).
That value is always `None`: `get_current_user` (`backend/app/dependencies.py:300`) returns
`{"id": ..., "email": ...}` and nothing else (measured at `:370`). So:

- the durable `ingestion_jobs` row is enqueued with `org_id` NULL, and
- the `documents` row is minted with no `org_id` (`mint_document_row` is called without one), so the column
  is filled by the migration-106 `autofill_org_id` trigger, which resolves
  `SELECT org_id FROM org_members WHERE user_id = … LIMIT 1` with **no ORDER BY**
  (`supabase/migrations/106_org_id_autofill_trigger.sql:97-101`). Its own comment says the `LIMIT 1` was
  unambiguous only because every user had one membership at Phase 162.

For a person in two orgs, a manual upload lands in whichever membership row Postgres returns first, not in the
org they are working in.

## Why it matters

A two-org admin (the exact subject Phase 266 flags) uploads a document while working in org B and it may be
filed under org A: invisible in org B's library and retrieval, visible to org A's members if shared. Nothing
errors, so nobody notices until the document is "missing". Single-org users are unaffected, which is why it has
not been reported.

Phase 266 did NOT fix it, by scope: D-266-18 org-scoped `mint_document_row`'s dedup and versioning only when
an `org_id` is passed, and `/upload` passes none, so `/upload` stays byte-unchanged (pinned by
`backend/tests/unit/test_266_mint_org_scope.py::test_upload_path_without_org_issues_the_base_queries_exactly`).
The Expert installer is told explicitly not to copy this shape (RESEARCH C-8).

## When to surface

Any phase whose `files_modified` names `backend/app/api/documents.py` (the upload handler),
`backend/app/dependencies.py` (`get_current_user` / active-org resolution), or an `autofill_org_id` migration;
or any report of an uploaded document appearing in the wrong org, or missing for a multi-org user.

## Scope estimate

Small to Medium. Resolve the active org the way the org-aware routes already do (the `X-Org-Id` dependency),
pass it to `mint_document_row` and `insert_ingestion_job`, and pin it with a two-org test. Passing `org_id`
also switches `/upload` onto D-266-18's org-scoped dedup, which is the correct meaning and must be stated in
that phase, since it changes which rows `/upload` treats as "already here". A trigger fix (ORDER BY, or refusing
to guess for multi-org users) is the Medium half.

## Breadcrumbs

- Phase 266 RESEARCH, finding C-8 (`266-RESEARCH.md` §claims table).
- D-266-18: `backend/app/services/ingest_splice.py` org-scoped at four sites when `org_id` is passed (266-02).
- Migration 106: `autofill_org_id` trigger, `LIMIT 1` without ORDER BY.

## 2026-10-14 - Phase 280 answered the folder arm only

Phase 280 plan 03 (D-26) made the shared minter check the folder's org: a foldered `/upload` mints into the
folder's org after a membership check, and a mismatch or non-member answers the same `404 "Folder not found"`
as a missing folder. That fixes the folder arm of this seed (BUG-261014-01, closed on live evidence).
A `/upload` with **no folder** is unchanged: it still mints with `org_id=None`, so the `autofill_org_id_by_owner`
trigger picks the owner's `LIMIT 1` org. The seed stays open for that arm; its trigger is unchanged.
