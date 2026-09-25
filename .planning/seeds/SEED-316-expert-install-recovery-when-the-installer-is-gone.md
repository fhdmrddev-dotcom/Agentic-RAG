---
seed_id: SEED-316
title: An Expert install cannot be repaired once its installing admin leaves the org or un-shares the folder, and the install cause carries raw error text
created: 2026-09-25
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching Expert install ownership (D-266-12), org member removal, folder sharing, or the install state wire shape; and before the first customer org with more than one admin installs an Expert.
trigger_paths: ["backend/app/services/expert_install_service.py", "backend/app/api/folders.py", "backend/app/api/experts.py"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "266-REVIEW WR-05", "266-REVIEW IN-05", "266-SECURITY W-1", "D-266-12"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-316: Expert install recovery when the installer is gone

## The finding (266 review WR-05, confirmed by the 266 security audit)

The install folder and its documents belong to the admin who pressed Install (D-266-12), and every
repair path requires ownership: `mint_document_row` answers 403 for a non-owner folder
(`FOLDER_NOT_OWNED`), a failed document gets `REDRIVE_NOT_OWNER`, and the folder delete policy is
`auth.uid() = user_id`.

1. **The installer leaves the org.** No remaining admin can restore a missing file, retry a failed
   one, or delete the folder so it can be recreated. The install stays `failed`, and its sentence tells
   people to ask someone who is no longer there.
2. **The installer un-shares the folder.** A different admin's `_ensure_folder` probe runs through
   RLS, sees nothing, creates a second folder, repoints the install and copies the corpus again. The
   original is orphaned (still readable by its owner); the only trace is `FOLDER_RECREATED` in the log.

## The wire half (IN-05 / SECURITY W-1)

`expert_install_service.py:206` puts a document's raw `error_message` on the wire as `install.cause`
(GET /experts, GET /experts/{id}, the management list, POST /install's 202). The UI classifies it
before rendering, and org members can normally read those document rows anyway, so this is mostly not
new exposure. **Case 2 above is the exception:** after an un-share, members lose RLS read on the rows,
but the overlay reads them through the pool and still ships the error text. The backend has no
ingestion-error classifier today, so the fix is either one (a cause code on the wire) or sending only
the fixed fallback sentence for `cause_source == "document"`.

## Why this is a decision, not a bug fix

It changes who owns an installed Expert. Options the review named: when the folder owner is no longer
an org member, let the install service (with `experts:manage` already proven) repoint to a new
caller-owned folder; and on re-install, tell "folder deleted" (`folder_exists is False`, read pool-side)
apart from "folder invisible to me", refusing the second with a named sentence. An org-owned folder
(no personal owner) is the larger alternative.
