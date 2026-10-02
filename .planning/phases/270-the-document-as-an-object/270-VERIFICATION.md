---
phase: 270-the-document-as-an-object
verified: 2026-10-03T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01: no independent §6.3 reviewer exists
status: passed
score: 4/4 success criteria verified
overrides_applied: 0
---

# Phase 270: The Document as an Object — Verification

**Goal:** a person can get the original file of any document they can access, and the detail panel says what the file is, with every date labelled for what it means.
**Mode:** initial verification, `verification_mode: self-verified` (solo project).

## Success criteria

| SC | Status | Evidence |
|---|---|---|
| 1. Download from list and panel; bytes hash equals `content_hash` | VERIFIED | Route `backend/app/api/documents.py:863` mints for the row `document_id` selects. UAT-LOG row SC#1: a 200 mint, then the fetched bytes' sha256 equals DB `content_hash`. Buttons are mounted in `DocumentRow.tsx` and `DocumentDetailPanel.tsx` through `DocumentDownloadButton.tsx` (grep-confirmed). G4-3 and G4-4(a) drove list, panel, history and connector docs. |
| 2. Control says latest vs viewed and fetches the named one | VERIFIED | Route returns `version_number`; each version is its own row id. UAT SC#2: v2 hash is v2's, differs from v3. G4-3 labels: `Download v3 (latest)` and `Download v2 (viewed, not latest)`. Finding F-1 (history actions hidden when the panel was open) was fixed and re-driven live. |
| 3. Cross-org refused with no URL; URL expires | VERIFIED | Code order at `documents.py:884-912`: `_assert_document_visible` (user-JWT/RLS) runs first; the service-role sign only follows, and signs the authorized row's own `file_path` (no path/bucket/version accepted). 404 for an invisible doc, 409 `not_stored`, 410 `file_missing`, `Cache-Control: no-store`. TTL read from the `document_download_url_ttl_seconds` setting and clamped 10..900 (`_clamp_download_ttl`, `documents.py:~850-858`), mirroring the migration 199 CHECK. UAT SC#3: org-B gets 404 with no `url` key (membership count proven 1, a different org); colleague gets 200 on a shared doc; the URL returned 400 `InvalidJWT exp` after TTL+5 s; failed row 410. |
| 4. Panel shows created/modified/pages/size/type/uploader; source-created vs added distinct; pre-270 shows "not recorded" | VERIFIED | Migration `supabase/migrations/199_document_file_facts.sql` adds four nullable columns, a positive-page CHECK, and the TTL setting with a 10..900 CHECK. It is DDL only with no backfill, and `supabase/full-schema.sql` carries all of it (lines 732-733, 1541-1546, 1591+). `file_facts.py` is called from `ingest_splice.py:518` through `run_in_threadpool`. G4-1: "Created in the file 12 Mar 2019" vs "Added to Agentic RAG 3 Oct 2026". G4-2: an old doc shows four italic `not recorded` rows, never 0. F-2 (connector `Added by` reading "You") was fixed and re-driven. |

## Independent checks run by the verifier

- Backend targeted: `test_270_download_url`, `test_270_file_facts`, `test_270_splice_writes_facts`, `test_270_document_response_facts` — 40 passed.
- Frontend targeted: `documentDownload.test.ts`, `DocumentFileFacts.test.tsx`, `DocumentRow.download270.test.tsx` — 3 files, 23 tests passed.
- Debt-marker scan (TBD/FIXME/XXX) over `file_facts.py`, `DocumentFileFacts.tsx` and `DocumentDownloadButton.tsx`: none.
- Level 4 (data flow): the facts come from real columns written at ingest, and `source_connection_name` comes from a user-JWT `connector_connections` lookup (`documents.py:~800-815`) that fails soft to None.

## Gates (taken from the documented record, not re-run)

- Backend baseline: 71 <= 71. tsc: 70 = baseline count. Ledger, size, seeds and deploy-drift gates: OK.
- Vitest count gate was RED with 5 `STACK_TRACE_ERROR` timeouts in `WorkflowsPage` (a SEED-171 flaky suite), `SettingsPage.changedFields` and `sketchComposition`. The failing set moved between runs, and none of the three files appears in `git diff 26308281a HEAD -- frontend` (per the UAT log). Judged by the documented triage: an inherited or flaky observation, not a phase defect. Not proof of innocence. `count gate OK` was not reached.

## Gaps

None blocking.

## Observations (non-blocking)

- The saved file name in the browser's download folder was not inspected (headless); the `Content-Disposition` filename is recorded.
- The main-list Actions column clips at a 1442 px viewport with the rail open. Not this phase's surface.
- Local-only. Migration 199 must reach production before the backend (`270-PROD-PARITY.md`). The Supabase `get_advisors(security)` run on production is owed at deploy.
- Requirement checkboxes in REQUIREMENTS.md (FIND-04/05 "Pending") and ROADMAP `[ ]` are still unflipped. The orchestrator owns that.

_Verifier: Claude (gsd-verifier)_
