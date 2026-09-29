---
seed_id: SEED-318
title: The installing admin's own /upload of a same-named file retires the Expert's install copy, dropping it to "not installed"
created: 2026-09-25
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching document versioning (mint_document_row's version lookup / is_latest retirement), /upload, or Expert install readiness.
trigger_paths: ["backend/app/services/ingest_splice.py", "backend/app/api/documents.py", "backend/app/services/expert_install_service.py"]
trigger_surfaces: []
migration_note:
relates_to: ["266", "266-REVIEW WR-03", "SEED-313"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-318: /upload versioning can retire an Expert's install copy

## What the WR-03 fix closed, and what it left

WR-03 had two directions. The fix (`12587efaa`) closes the first: the installer now mints with
`version_scope="folder"`, so an install never retires the admin's own same-named file elsewhere.

**The reverse direction is still open.** `/upload` versions by `(user_id, filename)` across every
folder and every org (it passes no `org_id` — SEED-313). The install copies are owned by the
installing admin. So if THAT admin later uploads a file named, say,
`acme_q3_2026_financial_report.md` anywhere, the upload retires the install copy's `is_latest`.
`list_install_corpus_documents` and retrieval both require `is_latest`, so the Expert silently drops to
"not installed" and its knowledge leaves search.

It no longer ping-pongs: a re-install now versions inside its own folder and leaves the person's file
alone, so one Install press restores both. But nothing tells anyone the Expert went dark.

## Why it is a decision

Fixing it means changing `/upload`'s versioning semantics for everyone (versioning per folder instead of
per filename across the account), or teaching the default retirement to skip Expert install folders. Both
touch a behaviour every upload depends on. Only the installing admin can trigger it, and only with an
exact filename match.
