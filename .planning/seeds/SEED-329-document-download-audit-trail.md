---
seed_id: SEED-329
title: Document download audit trail — a download mint writes no audit row
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: A phase adds audit action types (any edit to VALID_ACTION_TYPES or audit_log_action_type_check), OR an operator or customer asks "who downloaded this document", OR a compliance review asks for a download record.
trigger_paths: ["backend/app/services/audit_service.py", "backend/app/api/documents.py"]
trigger_surfaces: [library, admin]
migration_note: A new audit action type needs a numbered migration that widens audit_log_action_type_check, applied to the live DB BEFORE the backend that writes it boots.
relates_to: ["270", "FIND-04", "P-03", "D-05"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-329: Document download audit trail

## The finding

Phase 270 added `POST /documents/{id}/download-url`, which hands a user a short-lived signed link to the
original file. The mint writes **no audit row**: nobody can later answer "who downloaded this document, and
when". For a product that sells document access to organisations this is an ASVS V7 (logging) gap, not a bug
in the phase: FIND-04 required the download, not a record of it.

## Why it was deferred, not forgotten (P-03)

The audit table's action-type set is guarded twice: the Python `VALID_ACTION_TYPES` and the database CHECK
`audit_log_action_type_check`, and `assert_action_types_synced` refuses backend boot when the two disagree.
Adding a `document.download` type therefore ships as a migration that must be applied to the database
BEFORE the backend that writes it starts. That is a deploy-availability coupling on a path the phase did not
need, so the phase kept the mint a pure read-then-sign and left the record to a phase that owns audit types.

## What a later phase must decide

- The action-type name and the widened CHECK (one migration, applied before the backend deploy).
- What is recorded: user, org, document id, version number, minted-at. NEVER the signed URL or its token.
- Whether the write is best-effort (a failed audit write must not block a legitimate download) or
  fail-closed (compliance wants the record before the link exists). The two are different products.
- Where the write sits relative to the route's ordering fence: the visibility check must still come before
  any service-role call, so the audit write goes after the sign or on a user-scoped path.

## Re-open

Re-open at the first phase whose `files_modified` names `backend/app/services/audit_service.py`, or when
anyone asks who downloaded a document.
