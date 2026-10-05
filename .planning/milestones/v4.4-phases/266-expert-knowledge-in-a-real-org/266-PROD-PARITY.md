# 266 Production Parity Checklist — Expert knowledge in a real org

**Status: CHECKLIST ONLY. NOTHING HAS BEEN APPLIED TO PRODUCTION.** Plan 266-05 made no Supabase MCP call of
any kind, read or write, and pushed nothing to `master` or `production`. Every production WRITE below needs
**explicit per-action operator approval**: state exactly what will run, wait for a clear yes, then run it.
Approval for one write is never approval for the next (CLAUDE.md, "Supabase MCP — reads are free, WRITES ARE
APPROVAL-GATED").

Order matters. **Migration 195 goes in BEFORE the backend deploy** (step B). If the new backend runs against the
old index, the org-scoped mint writes a second org's completed copy of the same bytes under the OLD
`(user_id, content_hash)`-shaped unique index, and that write fails with `23505`.

---

## A. MCP READS first (free, no approval needed)

Run each against production and record the output beside it before doing anything else.

1. **Does `expert_installs` already exist?** (It should not.)
   ```sql
   SELECT to_regclass('public.expert_installs') AS expert_installs;
   ```
2. **Do migration 188's seed rows exist on prod?** Migration 195 retires them by fixed id.
   ```sql
   SELECT (SELECT count(*) FROM folders   WHERE id='00000000-0000-0000-0000-000000000260') AS folder_0260,
          (SELECT count(*) FROM documents WHERE id='00000000-0000-0000-0000-000000000261') AS doc_0261,
          (SELECT count(*) FROM document_chunks WHERE document_id='00000000-0000-0000-0000-000000000261') AS chunks_0261,
          (SELECT count(*) FROM skills    WHERE id='00000000-0000-0000-0000-000000000264') AS skill_0264;
   ```
   Record `skill_0264` BEFORE the paste. Migration 195 keeps that skill, and step C re-reads it.
3. **Both prod orgs' `subscription_tier`** (feeds F-4, section F):
   ```sql
   SELECT id, name, subscription_tier, created_at FROM organizations ORDER BY created_at;
   ```
   STATE.md records that both prod orgs were set to `enterprise` on 2026-09-23 (the v4.3 deploy). **Re-read it,
   don't trust the record.** Also count any org created since then with a NULL tier:
   `SELECT count(*) FROM organizations WHERE subscription_tier IS NULL;`.
4. **The current unique-index definition** (step B widens it):
   ```sql
   SELECT indexdef FROM pg_indexes WHERE indexname = 'documents_completed_hash_unique_idx';
   ```
5. **Would the widened index build?** It cannot fail, because a wider key only removes conflicts. Record it
   anyway:
   ```sql
   SELECT org_id, user_id, content_hash, count(*) FROM documents
   WHERE status = 'completed' AND content_hash IS NOT NULL
   GROUP BY 1,2,3 HAVING count(*) > 1;
   ```
   Expect 0 rows.

## B. Apply migration 195 — ONLY on explicit per-action operator approval, and BEFORE the backend deploy

- File: `supabase/migrations/195_expert_installs_and_seed_retirement.sql`. It is wrapped in `BEGIN/COMMIT`,
  idempotent, and builds the index WITHOUT `CONCURRENTLY` (that cannot run in a transaction; `documents` is
  small).
- Route: Supabase MCP `apply_migration`, or the operator pastes it into the cloud SQL editor. **Never
  `supabase db push` / `db reset`.**
- What it does: creates `public.expert_installs` (RLS on; members READ their org's rows; only the backend
  writes); widens `documents_completed_hash_unique_idx` to `(org_id, user_id, content_hash)`; deletes 188's
  orphaned seed knowledge (folder `…0260`, document `…0261`, chunks `…0262/…0263`) by fixed id, and nothing else.
- Precedent: migrations 182-193 went to prod through the MCP on per-batch approval (2026-09-23), and 194 was
  pasted by the operator (OV-265-01).
- ⚠ **ADDED AT THE 266 REVIEW TRIAGE (2026-09-25): apply migration 196 right after 195, same rules.**
  `supabase/migrations/196_documents_dedup_idx_org_scoped.sql` widens `documents_dedup_idx` to
  `(org_id, user_id, content_hash, COALESCE(folder_id, …))` (review WR-04). Without it, a two-org user's
  root-folder import or watch 409s every cycle against the new backend. Strictly looser key, idempotent,
  `BEGIN/COMMIT`, no `CONCURRENTLY`. Verify after:
  `SELECT indexdef FROM pg_indexes WHERE indexname = 'documents_dedup_idx';` must start its column list
  with `org_id`.

## C. Verify (the 266-01 Task 3 SQL set, now against prod)

| Query | Expected |
|---|---|
| `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.expert_installs'::regclass` | `true` |
| `SELECT has_table_privilege('anon','public.expert_installs','SELECT'), has_table_privilege('authenticated','public.expert_installs','INSERT'), has_table_privilege('authenticated','public.expert_installs','SELECT')` | `false, false, true` |
| `SELECT count(*) FROM pg_policies WHERE tablename='expert_installs'` | `1` |
| `SELECT indexdef FROM pg_indexes WHERE indexname='documents_completed_hash_unique_idx'` | contains `(org_id, user_id, content_hash)` |
| `SELECT count(*) FROM documents WHERE id='…0261'`, `folders WHERE id='…0260'`, `document_chunks WHERE document_id='…0261'` | `0, 0, 0` |
| `SELECT knowledge_folder_ids FROM expert_bundles WHERE slug='financial-analyzer'` | contains no `…0260` |
| `SELECT count(*) FROM skills WHERE id='…0264'` | equal to A.2's `skill_0264` |

## D. `get_advisors(security)`

- `expert_installs` must NOT be flagged (no RLS-disabled finding, no anon grant).
- Note any finding that is new since the 2026-09-23 read. BUG-260911-01 is the reason this step exists: every
  gate reads through the service role, and nothing in the suite requests as `anon`.

## E. Propose restoring the MCP `read_only` flag

Once the write-needing steps are done, propose restoring `read_only=true` in `.mcp.json`. It is the safer
default, and standing write access should not stay open.

## F. ⚠ F-4 — a freshly signed-up org has `subscription_tier = NULL` and CANNOT install — OPERATOR DECISION

- **Measured locally (266-05):** U1, U2 and U3 each got a personal org from `handle_new_user` with
  `subscription_tier = NULL`. The Install route refuses a NULL-tier org, so **no newly signed-up customer can
  install the Financial Analyzer** until someone sets a tier by hand. It is the same fact as the Phase 258
  record ("2 of 2 prod orgs had a NULL tier").
- **What prod needs:** A.3 reads both existing orgs' tiers (expected `enterprise`, set 2026-09-23) and counts
  NULL-tier orgs.
- **The decision the operator must make, how a new org gets a tier.** Options:
  - (a) A default tier set at org creation, via a migration that changes `handle_new_user` or a column DEFAULT.
    This is schema; it is not in 266 and needs its own phase.
  - (b) Operator-assigned per org via the Control Room. This is today's behaviour, and it is manual.
  - (c) A billing or plan flow that sets it. This is SEED-013 / Open Platform territory.
  Until one is chosen, **every new prod org is locked out of Expert install.** The whole `/experts` router is
  capability-gated (403 for a tier without the capability; `listExpertInstalls` turns that 403 into `[]`), so
  from the customer's side it reads as a refusal, not as a broken page.
- ⛔ Setting a prod org's tier is a WRITE, so it needs explicit per-action operator approval. Migration 194
  (OV-265-01) made `subscription_tier` not client-writable, so only the service role or an operator path can set it.

## G. Residuals that ship as-is (recorded, not fixed by 266)

- **SEED-314: thread, message and run org stamped from the FIRST membership.** For a user in two orgs,
  retrieval honours `X-Org-Id`, but `threads.org_id`, `messages.org_id` and `runs.org_id` are stamped by
  `autofill_org_id_by_owner` with the user's oldest org (measured in the SC#4-flip). **Prod impact:** metering
  and org history attribute a multi-org user's work to the wrong org. It is not a data leak, because retrieval
  is correct. `run_producer.py` is byte-unchanged (D-266-11).
- **SEED-315: an install Retry bypasses the ingest queue.** The re-drive's storage PUT to the existing key
  returns `409 Duplicate`, so it always takes the direct-splice fallback: no `ingestion_jobs` row, no queue
  retries, no lease recovery, nothing in the Ingestion tab. It was confirmed on the live local server after the
  F-1 fix (`266-UAT-LOG.md` F-1, `evidence/10`). The Retry does complete, because F-1 is fixed.

## H. After the deploy (operator steps)

Deploy only after an explicit operator "deploy". See step I.

1. **The corpus is in the image:** in the backend container, `ls app/experts/corpora/financial-analyzer`
   should list `manifest.json` and `acme_q3_2026_financial_report.md`. It is DATA, never imported (the Extension
   Contract). `.gitattributes` (266-02) keeps the bytes LF, so `corpus_version` matches across checkouts.
2. **An embedding provider key exists in the prod env.** Without one, an install mints the document and
   ingestion fails, and the Experts page shows `Install failed — retry` with the cause.
3. **"The new backend is up" probe:** unauthenticated `GET /experts/installs` returns `401` or `403`, not
   `404`.
4. As an enterprise-tier org admin, install the Financial Analyzer once. Then read, via the MCP (free), the
   SC#1 SQL from `266-UAT-LOG.md` against prod: every org column must equal that org, the status must be
   `completed`, and `embedded = chunk_count > 0`.

## I. Never push `master` or `production` without an explicit operator "deploy"

Promote surgically per `docs/DEPLOYMENT-WORKFLOW.md`. `scripts/check-deploy-drift.sh` read **`RESULT: PASS`** at
266-05. Migration 195 appears only in its non-blocking "seed-like" WARN list, and it REMOVES seed rows rather
than adding them, so the OPERATOR.md Step-3 seed list needs no entry. No env var, bundled service or sandbox tag
changed in 266.
