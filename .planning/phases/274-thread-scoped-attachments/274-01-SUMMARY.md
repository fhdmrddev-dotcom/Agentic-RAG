---
phase: 274-thread-scoped-attachments
plan: 01
subsystem: backend (workspace attachments, thread lifecycle, schema)
tags: [attachments, workspace_files, thread-delete, storage, migration-203, ATT-01]
requires: []
provides:
  - "upload_template ?lifetime=thread|template (Literal, default template)"
  - "_persist_workspace_upload(lifetime=...) REQUIRED kwarg — thread writes expires_at NULL"
  - "backend/app/services/thread_workspace_cleanup.py: collect_thread_workspace_paths, remove_workspace_paths"
  - "migration 203: workspace_files.library_document_id (FK ON DELETE SET NULL) + library_link"
affects:
  - "plan 274-02 (stamps library_document_id/library_link; regenerates OpenAPI again)"
  - "plan 274-03 (frontend composer must send ?lifetime=thread)"
tech-stack:
  added: []
  patterns:
    - "thin service seam called from a G-5 hot file (template_service.py shape)"
    - "door-chosen NULL expiry instead of a new kind"
key-files:
  created:
    - backend/app/services/thread_workspace_cleanup.py
    - supabase/migrations/203_workspace_files_library_link.sql
    - backend/tests/unit/test_274_attachment_lifetime.py
    - backend/tests/unit/test_274_delete_thread_cleanup.py
    - backend/tests/unit/test_274_migration_203_shape.py
    - .planning/phases/274-thread-scoped-attachments/274-BASELINES.md
  modified:
    - backend/app/api/workspace.py
    - backend/app/services/agent_loop.py
    - backend/app/api/threads.py
    - backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py
    - backend/tests/unit/test_244_attachment_prompt_line.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
decisions:
  - "Lifetime is chosen by the door via expires_at NULL; kind stays template_input (D-05/D-06) — no migration for the split"
  - "Raw FastAPI Query default fails CLOSED to the template TTL via an == ternary"
  - "Thread delete: collect (user-JWT, RLS) before the threads delete, remove after it, 100-path chunks, logged failures, user-prefix belt"
  - "Migration 203 has no pairing CHECK, because ON DELETE SET NULL nulls only the FK column"
  - "full-schema.sql regeneration NOT run by the executor: docker is permission-denied here and the CLI resolves the worktree dir name as the project id"
metrics:
  duration: "~55 min"
  completed: 2026-10-05
  tasks_completed: "2 of 3 fully; Task 3 done except step (f) full-schema regeneration (operator)"
---

# Phase 274 Plan 01: Thread-life attachments, thread-delete byte cleanup, migration 203 Summary

A composer attachment (local upload with `?lifetime=thread`, or any cloud attach) now writes
`expires_at = NULL`, so it lasts as long as its thread. The default upload door keeps its
24h template TTL. Deleting a thread now also deletes the attachment files in the `workspace-files`
bucket, using the person's own RLS-scoped client. The agent is no longer told that attachments
expire. Migration 203 adds the `In Library` mark columns. It is applied to the local DB twice and
proven by a rolled-back FK test.

## What was built

**Task 1: lifetime split + agent note (D-05, D-06, D-21, D-26, D-02)**
- `workspace.py`: `upload_template` gains `lifetime: Literal["template", "thread"] = Query("template")`
  and passes `"thread" if lifetime == "thread" else "template"`, so the raw `Query` object a direct
  caller receives fails closed to the TTL. `_persist_workspace_upload` takes a REQUIRED `lifetime`.
  Only the template arm reads `template_ttl_hours` (still one occurrence). The thread arm writes
  `expires_at=None`. The response always carries the key `expires_at`, with `null` on the thread
  arm. `attach_connection_file` passes `lifetime="thread"`. The two route docstrings are updated.
  `validate_upload`, `MAX_FILE_SIZE` and the minter fences are untouched.
- `agent_loop.py`: one literal changed. "They expire, so use them…" is now "They stay with this
  conversation for as long as it exists; use them here rather than assuming they exist anywhere
  else." `_ATTACHMENT_KIND` is unchanged.
- Two 244 cases were retired deliberately, and each test body states why: the cloud-attach case 1
  (D-05) and the note-expire case (D-26).
- OpenAPI snapshot and public spec regenerated; `build-public-openapi --check` OK.

**Task 2: thread-delete byte cleanup + migration 203 (D-08, D-28)**
- New `thread_workspace_cleanup.py` (thin seam):
  - `collect_thread_workspace_paths` reads `workspace_files` and then `workspace_file_versions`
    (`in_` in chunks of 100 ids) through the passed user-JWT client via `aexec`. It returns sorted,
    unique, non-null paths and drops (and logs) any path outside the caller's user prefix. On any
    failure it logs and returns `[]`.
  - `remove_workspace_paths` removes paths from `BUCKET_NAME` (imported) in chunks of 100 via
    `run_in_threadpool`. A failed chunk is logged with its size and the rest still run.
  - No service role, no bare `pass`.
- `threads.py delete_thread`: one import line, `collect` before the `threads` delete, `remove`
  after it. Zero new branches, enforced by an AST `if`-count test against PHASE_BASE.
- `203_workspace_files_library_link.sql` contains:
  - `library_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL`
  - `library_link text`, with the named check `workspace_files_library_link_check`
    (`IS NULL OR IN ('saved','already')`)
  - a partial index and refreshed column comments, including `expires_at`
  - no pairing CHECK, no GRANT, no RLS change, no backfill.

**Task 3: local apply (checkpoint, partially automated)**
- Applied twice via asyncpg against `127.0.0.1:54322`. Both runs returned `APPLIED OK`.
- VERIFY rows are quoted in `274-BASELINES.md`.
- Grants/RLS before and after: identical (`diff`).
- FK proof, rolled back: the document delete succeeded and the attachment's FK became NULL. A
  `'bogus'` link was rejected by `workspace_files_library_link_check`. A re-read after rollback
  confirmed the DB is clean.
- **Not done:** `bash scripts/regenerate-full-schema.sh` (see Deviations / OWED).

## Verification

- Task 1 verify suites (5): 49 passed. Task 2 suites: 21 passed, 32 across all four 274/276 suites.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/274-thread-scoped-attachments` →
  `ledger gate OK`.
- Full backend gate after Task 2: `71 failed, 6814 passed, 1 skipped, 2 xfailed, 2 xpassed`. The
  **failed SET is identical to the base SET**: 0 added, 0 removed.
- Acceptance greps:
  - `lifetime: Literal[...]` ×2
  - `They expire` 0
  - `stay with this conversation` 1
  - `_ATTACHMENT_KIND` 1
  - template_service / workspace_service / db/workspace diff empty
  - threads.py: 3 added lines, no `if`
  - `db push|db reset` 1 line (the NEVER sentence)
  - one `203_*` file

## Deviations from Plan

### Auto-fixed / process notes

1. **[Rule 3 - Blocking] The base backend run was contaminated by concurrent edits, and this is
   recorded rather than hidden.** The base run was started before the first edit but ran for six
   minutes, and the Task 1 GREEN edits landed while it was still running. It read `73 failed`. Two
   ids read files at test time and saw the half-edited tree:
   - `test_244_08…::test_the_content_route_is_not_widened`
   - `test_276_openapi_snapshot_fresh…`

   Both are green at HEAD. With them removed the base is 71 failed / 6784 passed, which matches
   the operator's independent 2026-10-05 develop measurement (71 / 6784). Full reasoning is in
   `274-BASELINES.md`.
2. **BASELINES.md was committed with Task 3's commit, not before Task 1's first edit.** The plan
   asked for it to be recorded first. The PHASE_BASE value and the base run did happen first; only
   the file was written later.
3. **`_persist_workspace_upload` gained an `if lifetime == "template":` arm.** The plan said "no
   new branch beyond the lifetime ternary", but it also required the single `template_ttl_hours`
   read to sit inside the template branch, which needs that arm. It is the only branch added.
4. **The versions read chunks ids at 100** (`_ID_CHUNK`). This keeps the `in_` URL bounded for a
   thread with many files (Rule 2, correctness). A 2-file thread still issues exactly one versions
   query.

### Not completed (handed to the operator)

- **Task 3 step (f) — `supabase/full-schema.sql` regeneration.** `regenerate-full-schema.sh`
  stops at its preflight. Run from this worktree, `supabase status` takes the project id from the
  directory name and looks for a container `supabase_db_agent-a27b8e8db6c5ae436` that does not
  exist. The steps after the preflight need `docker exec pg_dump`, and direct `docker` commands are
  permission-denied for this agent. Getting around that denial through the script was not
  attempted. `full-schema.sql` was not hand-edited.
- **Task 3 step (g) — `get_advisors(security)`.** The Supabase MCP tools were not available to
  this executor, so this is OWED.

## OWED

1. Operator, from the MAIN repo root after merge: `bash scripts/regenerate-full-schema.sh` (no
   `--reset`), then commit `supabase/full-schema.sql`. Name any unrelated drift in that diff.
2. Production: apply migration 202, then 203, before the backend that reads the columns deploys.
3. Production `get_advisors(security)`, both the pre-deploy baseline and the post-apply run.
4. Observation, out of scope: attachment bytes of threads deleted before Phase 274 stay orphaned
   in the bucket.
5. `graphify update .` was not run inside the worktree, because it would write the shared
   `graphify-out/`. It is left for the orchestrator after merge.

## Threat model coverage

- T-274-02: user-JWT only, the user-prefix belt is in place, and a static no-service-role test
  covers it.
- T-274-03: remove runs only after the delete returns, and a test proves that a failed delete
  removes nothing.
- T-274-04: every failure is a `logger.warning`; there is no bare `pass` in the seam.
- T-274-05: grants and RLS were identical before and after the local apply.
- T-274-06: the rolled-back FK proof shows the document delete is never blocked.

No new threat surface beyond the register.

## Known Stubs

None.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | e113b45b3 | test(274-01): add failing tests for thread-life attachment split and agent note |
| 1 GREEN | 86f9b6df4 | feat(274-01): composer attachments live for their thread; agent note tells the truth |
| 2 RED | 511c6585d | test(274-01): add failing tests for thread-delete byte cleanup and migration 203 shape |
| 2 GREEN | 78ce2ce7a | feat(274-01): thread delete removes attachment bytes; migration 203 In-Library mark |
| 3 | 2df428445 | chore(274-01): apply migration 203 locally + record baselines |

## TDD Gate Compliance

RED (`test(...)`) commits precede GREEN (`feat(...)`) commits for both TDD tasks. Every new case
was observed failing before its implementation: 9 failed in Task 1 RED, 21 failed in Task 2 RED.

## Self-Check: PASSED

- FOUND: backend/app/services/thread_workspace_cleanup.py
- FOUND: supabase/migrations/203_workspace_files_library_link.sql
- FOUND: backend/tests/unit/test_274_attachment_lifetime.py, test_274_delete_thread_cleanup.py, test_274_migration_203_shape.py
- FOUND: .planning/phases/274-thread-scoped-attachments/274-BASELINES.md
- FOUND commits: e113b45b3, 86f9b6df4, 511c6585d, 78ce2ce7a, 2df428445
- NOT PRESENT (owed by design): `library_document_id` in supabase/full-schema.sql
