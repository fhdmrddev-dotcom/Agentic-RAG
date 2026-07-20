-- 111_is_global_retirement_rename.sql
-- Phase 165 (MIG-02) — retire the legacy pre-org global boolean via the D-165-01 SEMANTIC SPLIT.
--
-- WHAT THIS DOES:
--   Value-preservingly renames the six legacy global-flag columns to their correct post-org names —
--   a semantic split, NOT a uniform rename:
--     * folders / skills                    → is_org_shared     (a genuine user org-share toggle)
--     * workflow_definitions / document_views / classification_rules / metadata_field_definitions
--                                           → is_system_global  (only ever platform-seed content)
--   plus the DEFINER visibility fn rename folder_is_globally_visible → folder_is_org_shared, the two
--   trigger fns that name the old column, and the Storage skill-files read policy. This file is the
--   SOURCE OF TRUTH for the whole phase — the backend/frontend/test renames (plans 02–09) mirror the
--   column names established here.
--
-- WHY THE SPLIT (not uniform is_org_shared) — D-165-01:
--   On the four write-locked tables the mig-108/109 INSERT/UPDATE write checks hard-set the flag = false
--   for authenticated writers, so a true value there is ONLY EVER seed/service-role platform content that
--   mig 109 lifts OUT of the org gate (universal). Renaming those to the org-scoped is_org_shared would
--   regress the 15 seeded workflows to the seed org (the exact mig-109 Test-7 bug). is_system_global keeps
--   them cross-org-universal BY CONSTRUCTION with zero data movement. folders/skills are genuine
--   user-owned org-share toggles → is_org_shared. (Operator-ratified deviation from 160-ADR §2, which
--   assumed a uniform rename before mig-109's 15 universal workflows existed.)
--   skills.is_system is NOT renamed (D-165-02) — it is the load-bearing skills universal allow-list
--   (load_skill tie-break / mig-109 badge-spoof WITH-CHECK / mig-087 seeding). is_system_global appears
--   as a column name ONLY on the four write-locked tables.
--
-- AUTO-PROPAGATION FACT (why this migration is short + transcription-risk-free):
--   PostgreSQL ALTER TABLE … RENAME COLUMN stores column references in RLS USING/WITH-CHECK clauses,
--   CHECK constraints, and indexes as parsed node-trees keyed on attribute-number, so a rename
--   AUTO-PROPAGATES to every mig-108/109 SELECT + INSERT/UPDATE-WITH-CHECK policy, the mfd_reachable
--   CHECK, and all indexes with the correct NEW per-table name. Do NOT hand-re-create those policies —
--   hand-transcription is the over-widening vector (T-165-01, the high-severity cross-org-leak threat).
--   Auto-propagation preserves mig-109 semantics VERBATIM. What does NOT auto-propagate: FUNCTION bodies
--   (pg_proc.prosrc is TEXT, parsed at runtime) — the DEFINER + trigger fns naming the old column are
--   explicitly CREATE OR REPLACE'd (§2), and the storage-policy reconciliation is a real semantic change
--   requiring explicit DROP + CREATE (§3).
--
-- DEV-SERVER NOTE (W1): plans 02–09 commit code that reads the RENAMED columns BEFORE this migration is
--   applied (Wave 2, plan 165-10). A running uvicorn/vite dev server would 500 on folder/skill/view/
--   workflow endpoints in the window between the Wave-1 commits and the apply. Operator STOPS any running
--   backend/frontend dev server before Wave 1 and restarts only AFTER plan 165-10 applies + regenerates.
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, OPERATOR-APPLIED ──────────────────────────────
--   NOT applied in this plan. Applied LOCAL by the OPERATOR pasting this whole file into the Supabase
--   SQL editor @ :54322 as ONE execution (pure DDL, BEGIN…COMMIT is fine) at the [BLOCKING] Wave-2 gate
--   (plan 165-10) — AFTER 110. NEVER `supabase db push` / `db reset` (preserves dev data). AFTER
--   applying: run `bash scripts/regenerate-full-schema.sh` (NO --reset — live-DB dump) and commit this
--   migration + the regenerated supabase/full-schema.sql together (D-165-06). NEVER hand-edit
--   full-schema.sql. Re-paste-safe: every statement is RENAME / CREATE OR REPLACE / DROP-IF-EXISTS+CREATE.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   111 joins the pending cloud set (099 → … → 110 → 111) + SECRETS_ENCRYPTION_KEY, applied to
--   production only at the next operator-gated push, in order. Do NOT apply to cloud now. Schema-only
--   value-preserving rename — seeds NO reference data, touches NO env var / bundled service / sandbox
--   tag — so it is NOT seed-bearing and owes NO docs/OPERATOR.md or check-deploy-drift.sh change (D-16
--   satisfied by exclusion, as migs 105/106/107/108/109/110).

BEGIN;

-- ================================================================================================
-- §1 — Column renames (6 value-preserving ALTER TABLE … RENAME COLUMN — the D-165-01 semantic split)
--   RENAME COLUMN is value-preserving (never drop+add): live row values + NOT NULL + DEFAULT + the
--   per-table universal-branch (=true) and write-lock (=false) RLS predicates all carry across unchanged
--   via attribute-number node-trees (see AUTO-PROPAGATION FACT). Do NOT hand-re-create the mig-108/109
--   SELECT + WITH-CHECK policies, the mfd_reachable CHECK, or the indexes — the rename carries the NEW
--   per-table name into each of them automatically (T-165-01: hand-transcription would over-widen).
--   skills.is_system is deliberately NOT touched (D-165-02 — the skills universal allow-list).
-- ================================================================================================
ALTER TABLE public.folders                    RENAME COLUMN is_global TO is_org_shared;
ALTER TABLE public.skills                     RENAME COLUMN is_global TO is_org_shared;
ALTER TABLE public.workflow_definitions       RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.document_views             RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.classification_rules       RENAME COLUMN is_global TO is_system_global;
ALTER TABLE public.metadata_field_definitions RENAME COLUMN is_global TO is_system_global;

-- ================================================================================================
-- §2 — Function / trigger bodies (TEXT — do NOT auto-follow the rename) — AUTHORED IN TASK 2
--   pg_proc.prosrc is TEXT parsed at runtime, so it does NOT follow RENAME COLUMN. The DEFINER
--   retrieval/visibility fns + the two trigger fns naming the old column must be explicitly
--   CREATE OR REPLACE'd, and folder_is_globally_visible OID-preservingly ALTER FUNCTION … RENAME'd
--   (so its dependent SELECT policies auto-follow by OID). Ordering: renames (§1) → functions (§2) →
--   storage policy (§3), with the folder fn renamed BEFORE its text-bodied callers reference the new name.
--   >>> Task 2 inserts §2 here. <<<
-- ================================================================================================

-- ================================================================================================
-- §3 — Storage skill-files read-policy reconciliation (semantic change — explicit DROP + CREATE)
--   Unlike table RLS, storage.objects policies are NOT affected by a public.skills column rename, and the
--   FIX-A universal escape (is_system) was never in this bucket policy — it currently keys ONLY on the
--   old org-gated branch. Reconcile it to the mig-109 skill_files table-RLS shape: the is_system branch
--   keeps the built-in skill-creator's files cross-org readable (mirrors the mig-109 skill_files universal
--   escape); the is_org_shared branch value-preservingly carries the renamed original global branch. The
--   owner-folder read + the INSERT/DELETE storage policies (owner-only, no old-flag reference) are untouched.
-- ================================================================================================
DROP POLICY IF EXISTS "Users can read own skill files" ON storage.objects;
CREATE POLICY "Users can read own skill files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name AND (s.is_system = true OR s.is_org_shared = true)
      )
    )
  );

COMMIT;

-- Closing note: 111 value-preservingly renames the six legacy global columns per the D-165-01 split
-- (folders/skills → is_org_shared; workflow_definitions/document_views/classification_rules/
-- metadata_field_definitions → is_system_global), leaving skills.is_system untouched (D-165-02). The
-- mig-108/109 SELECT + WITH-CHECK policies, the mfd_reachable CHECK, and the indexes are intentionally
-- NOT re-created here — RENAME COLUMN auto-propagated them verbatim (T-165-01 over-widening avoided).
-- §2 (Task 2) rewrites the DEFINER + trigger fn bodies (TEXT — do not auto-follow) and renames
-- folder_is_globally_visible → folder_is_org_shared OID-preservingly. §3 reconciles the storage
-- skill-files read policy onto the mig-109 is_system-universal + is_org_shared shape. One BEGIN/COMMIT
-- atomic, re-paste-safe. Apply AFTER 110 at the Wave-2 [BLOCKING] gate (plan 165-10); then regenerate
-- full-schema no-reset + commit both same-commit. 111 joins the pending cloud set (099→111) — not now.
