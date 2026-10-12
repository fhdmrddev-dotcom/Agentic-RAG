---
phase: 274-thread-scoped-attachments
plan: 02
subsystem: backend (Library promote of thread attachments)
tags: [attachments, promote, library, minter, ingest, workspace_files, ATT-03, ATT-02, D-18]
requires:
  - "274-01: migration 203 (workspace_files.library_document_id / library_link), thread-life attachments"
  - "274-03: the frontend client contract in frontend/src/lib/api/attachments.ts (field names matched verbatim)"
provides:
  - "POST /threads/{thread_id}/workspace/files/{file_id}/promote (201 saved / 200 already)"
  - "GET /threads/{thread_id}/workspace/files/{file_id}/promote-preview?folder_id="
  - "GET /threads/{thread_id}/workspace/library-links"
  - "app/api/workspace_promote.py: library_filename, library_mime, promotability, preview_promotion, WORKSPACE_UPLOAD_PREFIX"
  - "app/models/workspace_promote.py: PromoteRequest, PromoteResult, DuplicateOf, PromotePreview, LibraryLinkInfo, AttachmentLibraryState, LibraryLinksResponse, LibraryLink"
  - "the pinned six-module documents-minter set (D-18 backend half)"
affects:
  - "274-04 (mounts the dialog; reads library-links)"
  - "274-05 (lockstep-fences WORKSPACE_UPLOAD_PREFIX and the wire names; drives G-4 #3/#4 live)"
tech-stack:
  added: []
  patterns:
    - "own-module route beside a fenced hot module (document_search.py precedent)"
    - "duplicated read-only predicates pinned by a parity test over a FILTERING in-memory fake, not a shared helper"
    - "best-effort mark stamp after an irreversible mint"
key-files:
  created:
    - backend/app/api/workspace_promote.py
    - backend/app/models/workspace_promote.py
    - backend/tests/unit/test_274_promote_helpers.py
    - backend/tests/unit/test_274_promote_preview_parity.py
    - backend/tests/unit/test_274_promote_route.py
    - backend/tests/unit/test_274_minter_inventory.py
  modified:
    - backend/app/main.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/api/overview.md
decisions:
  - "On a duplicate, promote-preview's next_version carries the existing copy's version_number (exactly MintResult.version_number), so the parity test holds next_version == version_number on all four cases; the dialog keys its warning on duplicate_of"
  - "The audit row and the mark stamp both use the person's user-JWT client; the module creates no service-role client (the service role appears only inside the shared _enqueue_or_splice)"
  - "Both status arms are set explicitly on the injected Response (201 / 200), as /documents/upload does"
  - "The attachment row and its bytes are read on two short user-JWT connection acquisitions, so no DB connection is held across the existing-link HTTP reads or the mint"
  - "An attachment whose mark points at a document the person can no longer see through RLS is treated as unlinked and promotes again"
metrics:
  duration: "~17 min"
  completed: 2026-10-05
  tasks: 2
  files: 10
---

# Phase 274 Plan 02: Save a thread attachment to the Library — promote, preview and library-links Summary

A person can now copy one of their own chat attachments into a Library folder they pick. The copy
goes through the Library's own minter (`async_mint_document_row` with `version_scope="folder"`, the
active org and `on_conflict="link"`) and the shared ingest hand-off (`_enqueue_or_splice`). The
same bytes already in the Library come back as `already`, naming the folder where the existing copy
lives. A preview tells the dialog beforehand whether the save is refused, already done, or a new
version. One `library-links` read gives the chip and panel row their `In Library` mark. All of it
lives in a new module, so `workspace.py` still has no reach to the minter, and a fence now pins
every module that does.

PLAN_BASE (recorded before the first edit): `8b5bb124cfb0f4625d920869bc0306d435f526b2`.

## What was built

**Task 1: contract, helpers and the preview (D-13, D-14, D-22, D-27)**
- `models/workspace_promote.py`. `PromoteRequest` has a required `folder_id: UUID`, no default,
  no Root, and `extra="forbid"`, so no body key can carry an org. The response models use the
  wire names from 274-03's `attachments.ts` verbatim. `LibraryLink` is exactly
  `Literal["saved", "already"]`, the same two values as migration 203's CHECK.
- `library_filename` strips `^[0-9a-f]{8}-` (lowercase only, never leaves an empty name).
  `library_mime` applies the imported `_EXT_MIME_OVERRIDES` before the row's platform-guessed MIME.
  `promotability` gates on the imported `ALLOWED_MIME_TYPES` and refuses in the
  `/documents/upload` sentence shape.
- `preview_promotion` asks the minter's two questions read-only, in the minter's order: dedup
  (user + hash + completed + org) wins over the folder-scoped version lookup
  (user + filename + org + folder). It never reads `folders`.

**Task 2: the routes, the include, the fence, the docs (D-09, D-11, D-12, D-13, D-18, D-22, D-28)**
- `POST .../promote` runs in this order:
  1. `_verify_thread_ownership` (404 `Thread not found`).
  2. UUID parse, then `get_file_by_id` on the user-JWT connection. Missing, another thread's,
     expired, `kind != template_input` (agent-written or null) and malformed ids all collapse to one
     404 `File not found`.
  3. Existing-link short-circuit: the row's mark plus an RLS re-read of the document gives 200 with
     the stored link.
  4. D-22 refusal (422).
  5. Byte-exact `_get_file_content`.
  6. The mint. The minter's 403/404 propagate untouched; there is no folder pre-check.
  7. `_enqueue_or_splice`, only when the document is fresh.
  8. Best-effort user-JWT stamp of `library_document_id` and `library_link`. A failure is logged as
     a warning.
  9. `document.upload` audit with `source=thread_attachment`, `workspace_file_id`, `thread_id`,
     `document_id`, `outcome`, `folder_id` and `org_id`.

  It returns 201 `saved`, or 200 `already` with the existing document's `folder_id`.
- `GET .../promote-preview?folder_id=` applies the same 404 collapse. A refused type returns
  `promotable: false` plus the refusal without reading or hashing bytes. Otherwise it delegates to
  `preview_promotion`.
- `GET .../library-links` returns one entry per live `template_input` row, using the same
  `or_("expires_at.is.null,expires_at.gt.<now>")` gate as `workspace.py`. It makes one
  `documents.in_` read under RLS, and `link` is set only for a document that read returns. A failed
  select on the mig-203 columns re-selects without them and gives `link: null` everywhere, with a
  logged warning and status 200.
- `main.py`: one import name and one `include_router(workspace_promote.router)` line beside
  `workspace.router`. No other edit.
- OpenAPI regenerated: snapshot 234 paths / 285 operations / 223 schemas, public 192/234 paths /
  211 schemas, and `--check` OK. `router:workspace_promote` was added to `overview.md`'s `covers:`,
  and the docs coverage check reads `OK`.

## Verification

- TDD gates, each RED run and failing before its GREEN:
  - Task 1: `320ae2c48` test (32 failed), then `ac3ecef67` feat (32 passed).
  - Task 2: `5da3a250f` test (3 failed, 23 setup errors), then `58d13bb89` feat (70 passed with
    the 244 suite).
- Parity suite discrimination was proven by a plant. Dropping `.eq("folder_id", folder_id)` from
  the preview turned case 3 red (`AssertionError: assert 2 == 1`). The predicate was restored and
  the suite went green.
- **Minter-inventory RED drive (D-18).** A planted `backend/app/services/_plant_274_minter.py`
  calling `ingest_splice.mint_document_row(` produced:
  ```
  E       AssertionError: unexpected minters: ['services/_plant_274_minter.py']; missing: []
  ```
  The plant was removed and the suite went back to green (3 passed). It was never committed.
- Plan verify command (`test_274_promote_route`, `test_274_minter_inventory`,
  `test_274_promote_helpers`, `test_274_promote_preview_parity`, `test_244_cloud_attach_is_thread_scoped`,
  `test_276_openapi_snapshot_fresh`): 72 passed. Docs coverage OK. `build-public-openapi --check` OK.
- Hot-file ledger: `node scripts/check-hot-file-ledger.cjs .planning/phases/274-thread-scoped-attachments`
  printed `ledger gate OK — every watched file has a row.`
- **Full backend gate, run once under the local-DB lock (acquired and released):**
  ```
  71 failed, 6920 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 385.94s (0:06:25)
  [GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
  ```
  - Base, from the orchestrator (develop with wave 1 merged): 71 failed / 6859 passed / 0 errors.
  - Failed SET diffed with `comm` against the base SET in `274-BASELINES.md`: identical. The only
    textual difference is the known stderr fragment (`C:\Vibe`) appended to
    `test_lifespan.py::test_pg_pool_close_timeout_falls_back_to_terminate`, the same artefact
    BASELINES.md describes.
  - Passed went from 6859 to 6920, +61. Of that, 60 are this plan's new cases (collected). The
    remaining +1 was not attributed.
- Acceptance greps:
  - `version_scope="folder"`: 3
  - `on_conflict="link"`: 2
  - `include_router(workspace_promote.router)` in main.py: 1
  - `router:workspace_promote` in overview.md: 1
  - forbidden-name grep: 0
  - `ALLOWED_MIME_TYPES = `: 0
  - prefix regex: 1
  - `git diff 8b5bb124c -- ingest_splice.py documents.py workspace.py`: empty

## Deviations from Plan

**1. [Rule 1 - Bug] Explicit 201 on the fresh arm.** When a route coroutine receives a
`Response()`, its `status_code` defaults to 200. The plan only flipped the duplicate arm, and the
first GREEN run caught it. Both arms now set the status explicitly, as `/documents/upload` does at
`documents.py:736`. Through FastAPI the observable result is the same (201 / 200).

**2. Preview `next_version` on a duplicate.** The wire contract allows `int|null`. The plan did not
say what a duplicate reports. Reporting the existing copy's `version_number` (what
`MintResult.version_number` is for a duplicate) lets every parity case assert
`next_version == version_number` literally. 274-03's dialog shows the version warning only when
`duplicate_of` is null, so the client sees no behaviour difference.

**3. Two connection acquisitions instead of one block.** The row read and the byte read each open a
short `get_user_pg_connection`, so no Postgres connection is held across the existing-link HTTP
reads, the promotability gate or the mint. Both reads are still user-JWT/RLS and both still happen
before any mint (D-12).

**4. Audit `org_id`.** `write_audit_entry` is passed `org_id=<active org>`, which its signature
supports, plus `folder_id` and `filename` in the metadata beyond the plan's required keys.

## Known Stubs

None.

## Threat Flags

None. Every surface is in the plan's register:
- T-274-08: per-case 404 tests.
- T-274-09 / T-274-10: the static test covers no `get_supabase(`, no `service_role` and no
  `table("folders")`.
- T-274-11: the inventory fence plus the no-`documents`-insert static check.
- T-274-12: parity case 3 keeps the other folder's `is_latest`.
- T-274-13: `extra="forbid"`.
- T-274-14: links come only from the RLS documents read.
- T-274-15: the imported allow-list, with overrides applied first.
- T-274-16: `on_conflict="link"` plus the existing-link short-circuit.
- T-274-17: the audit.

## OWED (not this plan's to do)

- `graphify update .` was not run in the worktree, because it writes the shared `graphify-out/`.
  It is left for the orchestrator after merge.
- Production order still applies (274-01): migration 202, then 203, before this backend deploys.
  The stamp and library-links degrade gracefully without 203, but the mark would never appear.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 320ae2c48 | test(274-02): add failing tests for promote helpers, contract and preview-minter parity |
| 1 GREEN | ac3ecef67 | feat(274-02): promote contract, prefix/MIME/type helpers and a minter-parity preview |
| 2 RED | 5da3a250f | test(274-02): add failing tests for promote / preview / library-links routes and the pinned minter set |
| 2 GREEN | 58d13bb89 | feat(274-02): promote, promote-preview and library-links routes in their own module |

## TDD Gate Compliance

Both tasks have a `test(...)` commit before their `feat(...)` commit. Every new case was seen
failing before its implementation.

## Self-Check: PASSED

- FOUND: all 6 created files (2 source modules, 4 suites).
- FOUND commits: 320ae2c48, ac3ecef67, 5da3a250f, 58d13bb89 (test before feat for both tasks).
- The plant module `services/_plant_274_minter.py` is absent from the tree and was never committed.
- STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
