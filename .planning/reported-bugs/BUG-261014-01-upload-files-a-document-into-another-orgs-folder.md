---
id: BUG-261014-01
title: Upload files a document into another org's folder (the document's org differs from its folder's)
reported: 2026-10-14
surface: Agentic-RAG
severity: major
status: closed   # closed 2026-10-14 by Phase 280 plan 04 on live evidence
affected_areas: [backend/ingest, documents/folders, org-scope]
folded_into: "280"
verified_closed_by: "280 (8f83c307e — 280-LIVE-EVIDENCE.md SC#1)"
related_seeds: [SEED-313]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: a3d9406bc
  date: 2026-10-14
---

# BUG-261014-01: Upload files a document into another org's folder

Noted as **CR-01** inside BUG-261005-01 (Phase 274 review). Driven once, live, by Phase 280 plan 03
(D-05), and it reproduces. This is its own record, never folded silently into the same-bytes fix.

## What we observed

Live drive: `backend/tests/integration/test_280_cr01_two_org_live.py` at `a3d9406bc`, against the
local stack (:54321 PostgREST, :54322 Postgres). The subject is a fresh GoTrue user who is a member of
two orgs and owns one folder in each, plus one folder in a third org they do not belong to.

| Case | Call | Observed at `a3d9406bc` |
|---|---|---|
| Member of both, `/upload` shape (user JWT, `org_id=None`) into the folder of the NON-default org | `async_mint_document_row(folder_id=<org B folder>)` | **Minted.** `CR-01: the document landed in org 46fd0dae… while its folder is in org 822306c0… (the trigger's LIMIT 1 pick is 46fd0dae…)` |
| Explicit org ≠ folder org, import shape (user JWT, `org_id=A`, folder in B) | same, `org_id=<pick>` | **Minted** (`DID NOT RAISE`): an org A document inside an org B folder |
| Explicit org ≠ folder org, watch shape (service role, `on_conflict="link"`) | same | **Minted** (`DID NOT RAISE`) |
| Non-member folder, service role, `org_id=None` | folder in org C | **Minted** (`DID NOT RAISE`), stamped with the owner's `LIMIT 1` org |
| Non-member folder, user JWT, `org_id=None` | folder in org C | Refused `404 "Folder not found"` already, because the `folders` SELECT policy requires `org_id IN current_user_org_ids()`. Not a defect today; kept as a pin |
| Positive control: folder in the default org | | Minted into that org (correct) |

## Root cause

- `ingest_splice.mint_document_row`'s folder check selected `id, user_id` and compared **`user_id`
  only**. Nothing compared the folder's `org_id` with the org the document would be minted into.
- `/upload` passes `org_id=None`, so the document's org is stamped by `autofill_org_id_by_owner`:
  `SELECT org_id FROM org_members WHERE user_id = … LIMIT 1` with **no `ORDER BY`**. For a two-org
  person, "the minting org" is whatever heap order returns.
- Folders are stamped by the same trigger, so a folder created through the API lands in the same
  `LIMIT 1` org and the plain UI path cannot produce the mismatch. It arises only through folders
  stamped **explicitly**: an Expert install folder (`expert_install_service._ensure_folder`), or a
  folder in an org the person has since joined or left.
- Callers that pass `org_id` (import, watch, promote, expert install, email) could likewise mint into
  a folder of another org when given one.

## Fix shape (D-26, Phase 280 plan 03)

In the minter's folder check: select `id, user_id, org_id` through `maybe_row`. A missing folder is
`404 "Folder not found"` and another owner is the existing 403, both unchanged. Then:

- `org_id` passed and `folder.org_id != org_id` → the **identical** `404 "Folder not found"`.
- `org_id` is `None` → the caller must be a member of `folder.org_id` (a select on `org_members`
  under the client the minter received; the `org_members_self_select` policy lets a user read their
  own rows), else the identical 404. On success the minter mints with `org_id = folder.org_id`
  explicitly, so the trigger no-ops.

No new status code and no message that tells "exists in another org" apart from "does not exist"
(no existence oracle). This answers only the **folder** arm of SEED-313: a `/upload` with no folder
still lands in the trigger's org.

## Closed 2026-10-14 (Phase 280, plan 04)

The minter's folder check now requires the folder's org to match the minting org (or the caller's membership when no org is passed), with the identical 404 otherwise (fix `8f83c307e`). Live: `test_280_cr01_two_org_live.py` 6/6 re-run at `b794a40c5`: a two-org user's upload lands in the folder's org. The no-folder `/upload` arm stays with SEED-313. Evidence: `.planning/phases/280-in-once-out-clean/280-LIVE-EVIDENCE.md` SC#1.
