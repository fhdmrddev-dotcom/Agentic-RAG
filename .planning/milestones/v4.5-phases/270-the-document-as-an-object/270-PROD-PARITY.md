# 270 Production Parity Checklist — the document as an object

**Status: CHECKLIST ONLY. NOTHING HAS BEEN APPLIED TO PRODUCTION BY THIS PHASE.** Plan 270-05 performed no
Supabase MCP write and pushed nothing to `master` or `production`. Its only production contact was one
read-only `get_advisors(security)` run (recorded in section D). Every production WRITE below needs
**explicit per-action operator approval**: state exactly what will run, wait for a clear yes, then run it.
Approval for one write is never approval for the next (CLAUDE.md, "Supabase MCP — reads are free, WRITES ARE
APPROVAL-GATED").

**Order matters: migration 199 goes in BEFORE the backend deploy.** A backend on 270 code writes
`documents.page_count / source_created_at / source_modified_at / source_author` after every ingest and reads
`app_settings.document_download_url_ttl_seconds` on every download mint, and `DocumentResponse` selects the
new document columns. Against a database without them the facts write degrades with a warning, but the
download route and the document reads depend on the columns existing.

**The order is: (1) paste migration 199 into the cloud SQL editor, (2) verify with read-only queries,
(3) deploy the backend, (4) deploy the frontend.**

⚠ Earlier v4.4 phases (266-269) may also be pending on production. Run `scripts/pending-cloud-migrations.sh`
and apply every pending migration in number order, each on its own approval, before the backend deploy.

---

## A. MCP READS first (free, no approval needed)

1. **Do the columns already exist?** (They should not.)
   ```sql
   SELECT table_name, column_name, is_nullable, column_default, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'documents' AND column_name IN ('page_count','source_created_at','source_modified_at','source_author'))
       OR (table_name = 'app_settings' AND column_name = 'document_download_url_ttl_seconds'))
   ORDER BY 1, 2;
   ```
2. **Which migrations are pending?** `bash scripts/pending-cloud-migrations.sh`.

## B. Apply migration 199 — ONLY on explicit per-action operator approval, BEFORE the backend deploy

- File: `supabase/migrations/199_document_file_facts.sql`. Wrapped in `BEGIN/COMMIT`, idempotent
  (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`), DDL only: no INSERT, no UPDATE, no policy, no
  GRANT, no index. Safe to paste twice.
- Route: the operator pastes it into the cloud Supabase SQL editor (an operator-approved write). If the
  Supabase MCP `apply_migration` is used instead, it needs the same explicit per-action approval. **Never
  `supabase db push` / `db reset`.**
- What it does: adds four NULLABLE columns to `public.documents` (`page_count integer` with a CHECK `> 0`,
  `source_created_at timestamptz`, `source_modified_at timestamptz`, `source_author text`) and
  `public.app_settings.document_download_url_ttl_seconds integer NOT NULL DEFAULT 60` with the CHECK
  `app_settings_download_ttl_bounds` (10 to 900). No backfill: existing documents read "not recorded".

## C. Verify (read-only `execute_sql` SELECTs, no approval needed)

| Query | Expected |
|---|---|
| the section A.1 query, re-run | **five** rows: the four `documents` columns (all `is_nullable = YES`, no default) and `document_download_url_ttl_seconds` (`NO`, default `60`, `integer`) |
| `SELECT document_download_url_ttl_seconds FROM public.app_settings` | `60` on every row |
| `SELECT conname FROM pg_constraint WHERE conname IN ('documents_page_count_positive','app_settings_download_ttl_bounds')` | both present |
| `SELECT count(*) FROM public.documents WHERE page_count IS NOT NULL OR source_created_at IS NOT NULL` | `0` (no backfill) |
| `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('documents','app_settings')` | `true` on both |

## D. Security advisors — `get_advisors(security)` (a READ, no approval needed)

**Baseline recorded by plan 270-05, production, read-only, observed 2026-10-02T21:11:46Z, BEFORE migration 199
is applied to cloud (quoted verbatim):**

```
get_advisors(security) on PRODUCTION, read-only, observed_at 2026-10-02T21:11:46Z (BEFORE migration 199 is applied to cloud). 19 findings, 5 lint kinds:
- rls_enabled_no_policy (INFO) x3: public.app_settings, public.operator_audit_log, public.operator_users  (RLS on, no policies; service-role access only)
- function_search_path_mutable (WARN) x7: query_user_documents, resize_embedding_column, set_updated_at, update_search_vector, view_iso_to_date, workflow_definitions_block_published_update, skill_versions_block_mutation
- extension_in_public (WARN) x1: vector
- authenticated_security_definer_function_executable (WARN) x7: connection_doc_is_visible, current_user_has_permission, current_user_org_ids, folder_is_org_shared, keyword_search_chunks, match_document_chunks, match_skills
- auth_leaked_password_protection (WARN) x1: disabled
Migration 199 adds 4 nullable columns to public.documents and 1 NOT NULL DEFAULT 60 column + CHECK to public.app_settings; it adds no function, table, policy or grant. After the cloud apply, re-run get_advisors(security): the count must stay 19 with the same names; app_settings stays in the rls_enabled_no_policy list (unchanged).
```

**After the cloud apply (step B), re-run `get_advisors(security)` and compare:** the count must stay 19 with
the same names. Any new finding is a stop. (This is the deploy-parity item BUG-260911-01 added.)

## E. Backend + frontend deploy — operator "deploy" instruction only

- Backend (Coolify) and frontend (Vercel) both build from `production`. Promote surgically per
  `docs/DEPLOYMENT-WORKFLOW.md`; never push to `master`/`production` without the operator's explicit "deploy".
- **No env var was added or changed by 270, and no seed-bearing migration was added** (199 is DDL only, no
  rows), so `deploy/onebox.env.example`, `docs/OPERATOR.md` Step 3 and `docker-compose.prod.yml` need no change
  and the sandbox image tag is unchanged. `scripts/check-deploy-drift.sh` verdict on the merged tree:
  `RESULT: PASS — the one-box deploy artifacts are in sync` (docker compose denied in this shell, structural
  fallback used; CI runs the authoritative parse).
- `docs/OPERATOR.md` already records that migration 199 is schema, not a seed, and has no Step-3 entry.

## F. OWED at deploy — the cloud half of the Wave-0 spike

The local spike (270-SPIKE.md) proved that Storage emits `filename*=UTF-8''...` so the original filename
survives a navigation save. **The cloud half is not done.** At deploy, mint one download URL for a document
whose filename contains a space, an apostrophe and an en dash on CLOUD Storage and read the
`Content-Disposition` header. If the cloud header lacks `filename*`, the save step must switch to the blob
arm the spike left unbuilt. Record only the status and the header, never the URL.

## G. Post-deploy probe (the "new backend is up" signal)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<backend-host>/documents/00000000-0000-0000-0000-000000000000/download-url
```
Unauthenticated: **401 or 403** means the 270 route is served. **404 or 405** means the old backend is still
running. Then, signed in, request one real document you own and confirm `expires_in` is 60 and the response
carries `version_number`.
