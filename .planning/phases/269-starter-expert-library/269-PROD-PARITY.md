# 269 Production Parity Checklist — Starter Expert Library

**Status: CHECKLIST ONLY. NOTHING IN THIS FILE HAS BEEN APPLIED TO PRODUCTION.** Plan 269-05 made no
Supabase MCP call of any kind, read or write, and pushed nothing to `master` or `production`. Every
production WRITE below (a migration, a tier assignment, any DML) needs **explicit per-action operator
approval**: state exactly what will run, wait for a clear yes, then run it. Approval for one write is never
approval for the next (CLAUDE.md, "Supabase MCP — reads are free, WRITES ARE APPROVAL-GATED"). A deploy
needs an explicit operator **"deploy"**.

**What ships:** ~~FOUR system Experts — `financial-analyzer` (already in prod via 187), `contract-reviewer`,
`hr-policy-advisor`, `operations-analyst` (new, via 198). ⚠ `security-compliance` was **HELD** (D-269-09,
refusal FAIL — `query_documents` returned a sibling-folder document; `evidence/06-security-compliance-refusal.txt`,
reported-bugs `query-documents-ignores-restricted-expert-folder-scope.md`). It has **no row in 198 and no
corpus in the image**; do not add it by hand.~~
⚠ **CORRECTED 2026-09-29 (269 re-drive) — FIVE system Experts.** The hold's cause was BUG-260929-01
(fixed at `464ec8354`); re-driven in a fresh org after the fix, `security-compliance` passed install, cited
and refusal (`evidence/11-security-compliance-*.txt`), so 198 now carries its row `…2693` and the image
carries its corpus. Ships: `financial-analyzer` (187 + copy fix), `contract-reviewer`, `hr-policy-advisor`,
`security-compliance`, `operations-analyst`. ⛔ **The backend image in C must contain `464ec8354`**
(`sql_service._inject_folder_scope`): the live proof that admitted the fifth row was taken WITH the fix,
and without it every restricted Expert's `query_documents` can read a sibling folder's documents.

**Order is the whole point of this file:**

```
A. read state  →  B. 195 → 196 → 197 if still owed  →  C. backend deploy carrying the corpora, LIVE
   →  D. migration 198  →  E. get_advisors(security)  →  F. F-4 tier read (write only on approval)
   →  G. embedding key  →  H. post-deploy probe
```

⛔ **198 must NEVER precede C.** A system row whose corpus is not on disk in the running backend renders
**Start Chat** with **no Install button**, and a run then refuses with `ExpertScopeUnavailable` (269-RESEARCH
Pitfall 3 / M-12). Rows after files, always.

---

## A. MCP READS first (free, no approval needed)

Record each output beside it before doing anything else.

1. **Which migrations are applied?**
   ```sql
   SELECT version, name FROM supabase_migrations.schema_migrations
   WHERE version >= '194' ORDER BY version;
   ```
   Also probe by effect, because pasted migrations do not always leave a history row:
   ```sql
   SELECT to_regclass('public.expert_installs')                         AS mig_195_table,
          (SELECT indexdef FROM pg_indexes WHERE indexname='documents_dedup_idx') AS mig_196_idx,
          (SELECT count(*) FROM information_schema.columns
            WHERE table_schema='public' AND table_name='runs' AND column_name='expert_id') AS mig_197_col;
   ```
2. **System Expert rows today** (expect `financial-analyzer` only, before 198):
   ```sql
   SELECT id, slug, is_enabled, org_id, scope_mode, visibility, left(example_output, 80) AS example_head
   FROM expert_bundles WHERE is_system ORDER BY slug;
   ```
   Record whether the Financial Analyzer `example_output` contains `24.3` (the pre-fix figure) or `30.8%`.
3. **Orgs' tiers and the NULL-tier count** (feeds F):
   ```sql
   SELECT id, name, subscription_tier, created_at FROM organizations ORDER BY created_at;
   SELECT count(*) AS null_tier_orgs FROM organizations WHERE subscription_tier IS NULL;
   ```
4. **`tier_capabilities` has `experts` for enterprise:**
   ```sql
   SELECT tier, capability, enabled FROM tier_capabilities WHERE capability='experts';
   ```

## B. Migrations 195 → 196 → 197 — ONLY if A.1 shows them still owed

Follow `266-PROD-PARITY.md` §B-§C (195, then 196) and `268-PROD-PARITY.md` §B (197) exactly — they are not
restated here. Number order, each on its own approval, all before C. Phase 269 adds no schema and depends on
195 (`expert_installs`) for the Install path to exist at all.

## C. Backend deploy carrying the seeded corpora — ONLY after an explicit operator "deploy"

- Promote surgically per `docs/DEPLOYMENT-WORKFLOW.md` (fast-forward when the fix's parent is the
  `production` tip, else a throwaway-worktree cherry-pick). Never drag unfinished `develop` work into live.
- The image must carry `backend/app/experts/corpora/<slug>/` for **every seeded slug**. After the container
  is up, in the backend container:
  ```bash
  for s in financial-analyzer contract-reviewer hr-policy-advisor security-compliance operations-analyst; do
    ls app/experts/corpora/$s/manifest.json || echo "MISSING $s"
  done
  ls app/experts/corpora/   # expect exactly those five directories (was four + "no security-compliance" before the re-drive)
  grep -c "BUG-260929-01" app/services/sql_service.py   # expect >= 1: the OR-precedence fix is in the image
  ```
  Every line must resolve; any `MISSING` stops the checklist here — do not proceed to D.
- "The new backend is up" probe: an unauthenticated request to a route new since the running image returns
  `401`/`403`, not `404` (the v4.3 precedent).

## D. Apply migration 198 — per-action approval, and ONLY after C is verified

- File: `supabase/migrations/198_starter_expert_library.sql`. Data only — no DDL, no grants, no org id.
  ~~Three~~ **Four** `INSERT … ON CONFLICT (slug) WHERE is_system = true DO UPDATE` rows (`…2691` contract-reviewer,
  `…2692` hr-policy-advisor, `…2693` security-compliance, `…2694` operations-analyst) plus one `UPDATE` of the Financial Analyzer copy
  (D-269-P2: `30.8%` / `$29.1M`). Idempotent; safe to re-run.
- Route: Supabase MCP `apply_migration` on approval, or the operator pastes it into the cloud SQL editor.
  **Never `supabase db push` / `db reset`.**
- Verify:
  ```sql
  SELECT slug, org_id, scope_mode, visibility, is_enabled FROM expert_bundles WHERE is_system ORDER BY slug;
  -- expect exactly 5 (was 4 before the re-drive): contract-reviewer, financial-analyzer, hr-policy-advisor,
  -- operations-analyst, security-compliance;
  -- org_id NULL, scope_mode 'restricted', is_enabled true (the four new rows carry visibility 'public')
  SELECT example_output LIKE '%30.8%' AS fa_fixed FROM expert_bundles
   WHERE is_system AND slug='financial-analyzer';   -- expect true
  ```

## E. `get_advisors(security)` — standing rule

- No new finding on `expert_bundles` / `expert_installs` / `tier_capabilities` (no RLS-disabled table, no
  `anon` grant). 198 adds no grant, so any new finding is inherited — record it, do not assume it.
- BUG-260911-01 is why this step exists: every gate reads through the service role; nothing in the suite
  requests as `anon`.
- Then propose restoring the MCP `read_only` flag (`266-PROD-PARITY.md` §E).

## F. F-4 — NULL-tier orgs, per ruling D-269-P1

- **Ruling (operator, 2026-09-29):** tiers stay **operator-assigned**. No `handle_new_user`, tier default or
  capability change. SC#1 holds for **an org on the enterprise tier**; a freshly signed-up NULL-tier org
  sees the tier refusal (`403`, "requires 'enterprise' tier"), never a blank page. Gap planted as
  **SEED-325**.
- A.3's NULL-tier count is the number of prod orgs that will see the refusal, not the library.
- ⛔ **Assigning a tier to a prod org is a WRITE** — one org per approval, stated exactly
  (`UPDATE organizations SET subscription_tier='enterprise' WHERE id='<id>'`). Migration 194 made
  `subscription_tier` non-client-writable, so only the service role or an operator path can set it.

## G. An embedding key exists in the prod env

Without one, an install mints the documents and ingestion fails; the Experts page shows `Install failed —
retry` with the cause. Check the Coolify env for the configured embedding provider's key (read only — never
decrypt or print it).

## H. Post-deploy probe (operator, in an enterprise-tier org)

1. `GET /experts` with that org's `X-Org-Id` lists exactly the ~~four~~ **five** starter slugs.
2. Install ONE new Expert (e.g. `contract-reviewer`) through the Experts page: `installing` → `ready`.
3. Read (free, MCP): the install's documents are `completed` with `chunk_count > 0`, every row's `org_id`
   equals that org, and no chunk exists outside it (the SC#1 SQL in `269-UAT-LOG.md` / `266-UAT-LOG.md`).

## Residuals shipped as-is (recorded, not fixed by 269)

- ~~**`query_documents` ignores a restricted Expert's folder scope** — the reason security-compliance is held;
  it equally affects the four shipped Experts' tool surface (reported-bugs entry, open). Same-org metadata
  only; no cross-tenant read was observed.~~ **CORRECTED:** BUG-260929-01 is fixed in code (`464ec8354`) and
  closed on live re-drive evidence (`269-REDRIVE-SUMMARY.md`) — but production has the fix only once C ships it.
- **SEED-325** (NULL-tier signup) and **SEED-326** (greenfield runbook seed rows beyond the Expert catalog).
- G-4 screenshots `g4-*` are owed; 267 remains `human_needed` (inherited dependency).

## Deploy-artifact parity

No env var, bundled service or sandbox tag changed in 269. The one seed-bearing migration (198) is listed in
`docs/OPERATOR.md` Step-3 with 186/187/189; `scripts/check-deploy-drift.sh` read `RESULT: PASS` with
`all 13 runbook seed migrations exist (highest listed: 198)` at 269-05.
