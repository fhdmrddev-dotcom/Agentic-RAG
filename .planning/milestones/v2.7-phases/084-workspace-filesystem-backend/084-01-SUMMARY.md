---
phase: 084-workspace-filesystem-backend
plan: 01
type: execute
status: complete
completed: 2026-05-28
---

## Phase 084 Plan 01: Database Schema Migration Summary

**Workspace filesystem schema landed -- workspace_files + workspace_file_versions tables, FK-chain RLS, and private storage bucket created in live local DB. Bootstrap full-schema.sql regenerated.**

## Dependency Graph

requires: []
provides:
  - "workspace_files table with UNIQUE(thread_id, path), 10MB size constraint, 500-char path constraint"
  - "workspace_file_versions table with UNIQUE(workspace_file_id, version)"
  - "FK-chain RLS on both tables (auth.uid() == thread owner)"
  - "Private workspace-files storage bucket with user-scoped RLS"
affects: [084-02, 084-03, 084-04]

## Tech Tracking

tech-stack:
  added: []
  patterns:
    - "FK-chain RLS: auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id) for workspace_files"
    - "Two-level FK chain RLS for versions: threads -> workspace_files -> workspace_file_versions"
    - "Hybrid content storage: content_inline bytea + content_storage_path text (per D-05)"

key-files:
  created:
    - supabase/migrations/054_workspace_files.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "Migration applied via Supabase SQL editor (per CLAUDE.md), then full-schema.sql regenerated via scripts/regenerate-full-schema.sh"
  - "Supabase SQL editor flagged 'New tables will not have RLS' as static warning -- false positive because our migration explicitly runs ALTER TABLE ... ENABLE RLS in Sections 3-4; ran with 'Run and enable RLS' option which is a no-op against our explicit statements"
  - "storage.buckets INSERT for workspace-files lives only in the migration file -- pg_dump --schema-only does not dump storage.buckets data (confirmed sandbox-outputs from migration 029 follows the same pattern)"

requirements-completed: [WS-01, WS-05, WS-06]

## Performance

- **Duration:** ~5 min (file write + human apply + regen + commits)
- **Started:** 2026-05-28
- **Completed:** 2026-05-28

## Accomplishments

- Created `supabase/migrations/054_workspace_files.sql` (105 lines) with:
  - `workspace_files` table: nested-path filesystem with hybrid content storage, 10MB size constraint, 500-char path constraint, UNIQUE(thread_id, path)
  - `workspace_file_versions` table: per-version full content + delta JSONB, UNIQUE(workspace_file_id, version)
  - 4 RLS policies on workspace_files (SELECT/INSERT/UPDATE/DELETE) with FK-chain to threads.user_id
  - 2 RLS policies on workspace_file_versions (SELECT/INSERT) with two-level FK-chain
  - 3 storage RLS policies on workspace-files bucket with user-id-prefix path check
- Applied migration to live local Supabase DB via SQL editor
- Regenerated `supabase/full-schema.sql` (1857 lines, +166 net) via `bash scripts/regenerate-full-schema.sh` (no-reset live-dump mode)
- Both schema artifacts committed atomically (Task 1: 652020c, Task 2: 41ccdc7)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 054_workspace_files.sql** -- `652020c` (feat)
2. **Task 2: Apply migration via Supabase SQL editor + regenerate full-schema.sql** -- `41ccdc7` (chore)

## Files Created/Modified

- `supabase/migrations/054_workspace_files.sql` - New: workspace filesystem DDL + RLS + storage bucket (105 lines)
- `supabase/full-schema.sql` - Modified: regenerated to include workspace_files + workspace_file_versions tables, constraints, indexes (+166 net lines)

## Decisions Made

- **Static-analyzer warning at apply-time:** Supabase SQL editor flagged "destructive operations" (the `DROP POLICY IF EXISTS` statements on storage.objects) and "new tables will not have RLS." Both were false positives -- the destructive ops are idempotency guards matching the 029 pattern, and the tables explicitly run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same script. User ran with "Run and enable RLS" (no-op against our explicit statements).
- **Bucket reference in full-schema.sql:** The plan's acceptance criterion "supabase/full-schema.sql contains workspace-files bucket reference" is not achievable with `pg_dump --schema-only` (which `regenerate-full-schema.sh` uses by default). storage.buckets rows are DATA, not schema. The bucket is preserved in the migration file (which is what greenfield deploys apply). The sandbox-outputs bucket from 029 follows the same pattern -- 0 occurrences in full-schema.sql despite existing in the live DB. This is a minor plan defect, not an implementation defect.

## Deviations from Plan

None on implementation. One minor plan-defect noted above (full-schema bucket criterion not achievable via pg_dump --schema-only).

## Auto-Fixed Issues

None.

## Issues Encountered

- Supabase SQL editor static-analyzer warning at apply-time (false positive). Resolved by selecting "Run and enable RLS" which is a no-op against the migration's explicit `ALTER TABLE ... ENABLE RLS` statements.

## User Setup Required

User applied the migration via Supabase SQL editor (per CLAUDE.md "never `supabase db push`" rule). No further user setup required for downstream plans.

## Next Phase Readiness

- workspace_files and workspace_file_versions tables exist in live local DB
- RLS policies enforce per-user access via FK chain through threads.user_id
- workspace-files storage bucket exists as private with user-id-prefix RLS
- Plan 02 (DB layer + service) can now read/write workspace data via asyncpg
- Plan 03 (tool handlers) and Plan 04 (REST API) build on the service layer from Plan 02
