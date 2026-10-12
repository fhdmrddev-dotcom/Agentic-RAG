---
phase: 270-the-document-as-an-object
plan: 02
subsystem: backend-api
tags: [documents, download, signed-url, rls, storage]
requires: []
provides:
  - "POST /documents/{id}/download-url (RLS read first, service-role sign second)"
  - "DocumentResponse file facts + source_connection_name"
  - "document_download_url_ttl_seconds setting field (default 60)"
affects: [backend/app/api/documents.py, backend/app/models/document.py, backend/app/models/user_settings.py]
tech-stack:
  added: []
  patterns: ["authorize on user-JWT client, then privileged sign of the authorized row's path"]
key-files:
  created:
    - backend/tests/unit/test_270_document_response_facts.py
    - backend/tests/unit/test_270_download_url.py
  modified:
    - backend/app/api/documents.py
    - backend/app/models/document.py
    - backend/app/models/user_settings.py
decisions:
  - "P-06: user-JWT visibility + row read, then service-role sign (bucket SELECT policy is owner-only, so user-JWT sign would 404 colleagues)"
  - "P-03: no audit write this phase"
  - "TTL clamped 10..900 in code; non-int/None falls to 60"
requirements: [FIND-04, FIND-05]
metrics:
  completed: 2026-10-02
---

# Phase 270 Plan 02: Download mint and file facts Summary

A document's original file can now be fetched via a 60-second signed URL minted only after the caller's access is proven through the user-JWT/RLS path, and file facts plus the connection name reach the wire.

## Tasks

| Task | Commits |
|---|---|
| 1 Facts + connection name + TTL field | RED `010eb9ffe`, GREEN `76bee2c68` |
| 2 download-url route | RED `f04918cdb`, GREEN `5575d17ea` |

RED evidence: Task 1 suite failed at collection (`ImportError: cannot import name 'DocumentDownloadUrl'`); Task 2 suite failed with `AttributeError: module 'app.api.documents' does not have the attribute 'load_app_settings_async'` on every route case.

## Verification

- `test_270_download_url.py` + `test_270_document_response_facts.py` + `test_217_document_detail_routes.py`: 47 passed.
- Four `?raw` frontend suites over documents.py: 4 files / 94 tests passed; `sourceCeilingCopy.test.ts` 9 passed.
- Full backend gate: `71 failed, 6077 passed, 2 xfailed, 2 xpassed, 0 errors` — GATE PASSED (at the ceiling, no new failure; I did not capture the per-name baseline SET before editing, so ceiling-equality is the evidence, not set identity).
- AST order fence: clean on real source; the planted reorder (`_early = service_supabase` inserted before the visibility await) is driven inside the suite (`test_ast_fence_reds_on_planted_reorder`) and trips it — the plant is applied to an in-memory copy, so the real file was never modified.
- Ordered-log test (two distinct doubles) proves zero service-side entries before the sign and zero storage calls for an invisible document.

## Deviations from Plan

- Worktree HEAD began on master (`86d9559bb`), not the expected base; reset to `26308281a` per the branch-check instructions before any work.
- AST-fence plant is a permanent in-suite test on a source copy rather than a one-off edit-and-revert (stronger, same evidence).
- Baseline SET not captured (270-BASELINES.md not present in this worktree); see Verification.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-270-07..15 mitigations implemented as specified: 404-not-403, no path/bucket/version input, `download` attachment option, no-store, URL never logged).

## Self-Check: PASSED
