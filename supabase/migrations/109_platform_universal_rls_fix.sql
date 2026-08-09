-- 109_platform_universal_rls_fix.sql
-- Phase 163 (TEN-01) — FIX-A gap closure for the 163-UAT Test-7 regression.
--
-- WHAT WENT WRONG (163-UAT Test 7): migration 108 rewrote every user-facing SELECT policy to the
-- membership shape  org_id IN (SELECT public.current_user_org_ids()) AND (<owner> OR <global branch>).
-- That correctly org-scopes USER-shared global content, but it ALSO trapped the PLATFORM/system branch
-- INSIDE the org-gate. In the post-162 solo-org topology (every user in their own personal org) the
-- built-in skill-creator (is_system=true, owned by seed …0001) and the seeded is_global starter
-- workflows became visible only to their seed org — i.e. the built-in skill-creator dropped from all
-- users to one. Symptom two: a document inside a global folder likewise lost cross-user visibility.
--
-- FIX A (operator-locked): lift ONLY platform/system-seeded content OUT of the org-gate; keep
-- USER-self-served global content INSIDE the gate. Two escape keys, both platform-only by construction:
--   * is_system = true on skills (+ its EXISTS-on-skills(is_system) children skill_files / tuner_runs).
--     is_system is write-locked to migration 087 — no route sets it (and this migration now HARDENS
--     that with a badge-spoof write check) — so is_system=true is only ever seed content.
--   * is_global = true on the four hard-set-false-for-users tables workflow_definitions / document_views
--     / classification_rules / metadata_field_definitions. Their mig-108 INSERT/UPDATE write checks
--     hard-set is_global=false for authenticated writers, so is_global=true there is only ever seed /
--     service-role platform content.
-- USER-self-served global content STAYS org-scoped and is deliberately NOT touched here:
--   * skills.is_global (the gated owner toggle) + folders.is_global (owner toggle) + the documents
--     folder_is_globally_visible branch (derives from folders.is_global) remain INSIDE the org-gate.
--   These become cross-user-visible again only when orgs gain members (Phases 166/167). The documents
--   and folders read policies are therefore intentionally left UNCHANGED by this migration — that is
--   the point of Fix A (user-shared stays gated).
--
-- BADGE-SPOOF WRITE HARDENING (T-163-11): because Fix A makes is_system=true a UNIVERSAL read escape
-- and Phase 163 makes RLS the ENFORCED gate, the skills INSERT + UPDATE write checks gain
-- AND (is_system = false) so an authenticated user cannot self-set is_system=true (badge-spoof ->
-- cross-tenant broadcast). Mirrors the is_global=false write checks already on document_views(108) /
-- classification_rules(108) / metadata_field_definitions(108). Seed/system rows are written by the
-- migration / service-role (BYPASSRLS) so they are unaffected.
--
-- 42P17-SAFE + INERT-MECHANISM PRESERVED: every corrected predicate still calls the SECDEF
-- public.current_user_org_ids() helper on its org-gated branch (NEVER an inlined recursive membership
-- subquery — that is the 161 recursion break). Each policy is dropped-if-exists then re-created
-- (Postgres has no create-or-replace for policies) — re-paste-safe. The READ branch is only WIDENED
-- for platform rows; no owner / insert / update / delete predicate is loosened beyond the explicit
-- is_system hardening.
--
-- APPLIES AFTER 108 (integer filename order). The SECDEF retrieval functions (match_document_chunks
-- etc.) are NOT touched here — that is Phase 164. Do NOT edit 108. Do NOT run
-- regenerate-full-schema.sh in this authoring step (Task 3 does that AFTER the operator applies this).
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, OPERATOR-APPLIED ──────────────────────────────
--   Applied LOCAL by the OPERATOR pasting this whole file into the Supabase SQL editor @ :54322 as ONE
--   execution (pure DDL, BEGIN…COMMIT is fine) — AFTER 108. NEVER `supabase db push` / `db reset`
--   (preserves dev data), and NEVER a Claude-driven psycopg2 DDL apply for this gate. AFTER applying:
--   run `bash scripts/regenerate-full-schema.sh` (no --reset) and commit this migration + the
--   regenerated supabase/full-schema.sql together (D-06). NEVER hand-edit full-schema.sql.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   109 joins the pending cloud set (099 → … → 108 → 109), applied to production only at the next
--   operator-gated push, in order. Schema-only policy DDL — seeds NO reference data, touches NO env
--   var / bundled service / sandbox tag — so it is NOT seed-bearing and owes NO docs/OPERATOR.md or
--   check-deploy-drift.sh change (D-16 satisfied by exclusion, as mig 108).

BEGIN;

-- ================================================================================================
-- §1 — SELECT: lift the PLATFORM branch OUTSIDE the org-gate (7 policies)
--   Shape:  (<platform branch>) OR (org_id IN (SELECT public.current_user_org_ids()) AND (<owner> OR <user-global>))
--   The org-gated branch is preserved VERBATIM from 108 (owner OR the user-self-served global expr);
--   only the platform branch is hoisted out so seed/system content is universal again.
-- ================================================================================================

-- 1. skills — universal escape = is_system = true (the built-in skill-creator) --------------------
DROP POLICY IF EXISTS "Users can view own and global skills" ON public.skills;
CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT TO authenticated
  USING ((is_system = true)
         OR (org_id IN (SELECT public.current_user_org_ids())
             AND ((auth.uid() = user_id) OR (is_global = true))));

-- 2. skill_files — universal EXISTS-on-skills(is_system) OUT of the gate; is_global EXISTS stays in -
DROP POLICY IF EXISTS "Users can view files on own or global skills" ON public.skill_files;
CREATE POLICY "Users can view files on own or global skills" ON public.skill_files FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
             FROM public.skills
            WHERE ((skills.id = skill_files.skill_id) AND (skills.is_system = true))))
         OR (org_id IN (SELECT public.current_user_org_ids())
             AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
                 FROM public.skills
                WHERE ((skills.id = skill_files.skill_id) AND (skills.is_global = true)))))));

-- 3. tuner_runs — same universal EXISTS-on-skills(is_system) branch OUT of the gate ---------------
DROP POLICY IF EXISTS "Users can view tuner runs on own or global skills" ON public.tuner_runs;
CREATE POLICY "Users can view tuner runs on own or global skills" ON public.tuner_runs FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
             FROM public.skills
            WHERE ((skills.id = tuner_runs.skill_id) AND (skills.is_system = true))))
         OR (org_id IN (SELECT public.current_user_org_ids())
             AND ((auth.uid() = user_id) OR (EXISTS ( SELECT 1
                 FROM public.skills
                WHERE ((skills.id = tuner_runs.skill_id) AND (skills.is_global = true)))))));

-- 4. workflow_definitions — universal is_global (hard-set-false-for-users) OUT; owner = created_by -
DROP POLICY IF EXISTS "Users can view own and global workflow definitions" ON public.workflow_definitions;
CREATE POLICY "Users can view own and global workflow definitions" ON public.workflow_definitions FOR SELECT TO authenticated
  USING ((is_global = true)
         OR (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = created_by)));

-- 5. document_views — universal is_global (hard-set-false-for-users) OUT of the gate --------------
DROP POLICY IF EXISTS "Users can view own and global document_views" ON public.document_views;
CREATE POLICY "Users can view own and global document_views" ON public.document_views FOR SELECT TO authenticated
  USING ((is_global = true)
         OR (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id)));

-- 6. classification_rules — same shape ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own and global classification_rules" ON public.classification_rules;
CREATE POLICY "Users can view own and global classification_rules" ON public.classification_rules FOR SELECT TO authenticated
  USING ((is_global = true)
         OR (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id)));

-- 7. metadata_field_definitions — same shape ------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions;
CREATE POLICY "Users can view own and global metadata_field_definitions" ON public.metadata_field_definitions FOR SELECT TO authenticated
  USING ((is_global = true)
         OR (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id)));

-- ================================================================================================
-- §2 — WRITE CHECK: badge-spoof hardening (T-163-11), skills only (2 policies)
--   is_system = false blocks an authenticated user self-setting is_system=true now that it is a
--   universal read escape. Seed / service-role writes are BYPASSRLS -> unaffected.
-- ================================================================================================

-- 8. skills INSERT — add AND (is_system = false) to the 108 owner check ---------------------------
DROP POLICY IF EXISTS "Users can insert own skills" ON public.skills;
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_system = false));

-- 9. skills UPDATE — USING unchanged from 108; ADD a write check carrying AND (is_system = false) --
--    (108's FOR UPDATE had ONLY a USING clause; adding a write check now closes the self-set path.)
DROP POLICY IF EXISTS "Users can update own skills" ON public.skills;
CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id) AND (is_system = false));

COMMIT;

-- Closing note: 109 widens the READ branch of 7 mig-108 SELECT policies so platform / is_system content
-- (the built-in skill-creator + its skill_files / tuner_runs; the seeded is_global workflow_definitions
-- / document_views / classification_rules / metadata_field_definitions) escapes the org-gate again, and
-- hardens the 2 skills WRITE checks so is_system=true cannot be self-set. USER-self-served global
-- content (skills / folders / global-folder documents) stays org-scoped by design (untouched). Every
-- org-gated branch still calls the SECDEF public.current_user_org_ids() helper (42P17-safe); the whole
-- file is one BEGIN/COMMIT atomic re-paste-safe apply. Apply AFTER 108; then regenerate full-schema
-- (Task 3). The documents + folders read policies are deliberately absent here.
