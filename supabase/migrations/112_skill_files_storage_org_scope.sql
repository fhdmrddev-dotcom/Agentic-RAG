-- 112_skill_files_storage_org_scope.sql
-- SEED-125 (CR-02) — org-gate the skill-files Storage READ policy's shared branch.
--
-- WHAT THIS DOES:
--   Rewrites the ``skill-files`` storage.objects SELECT policy so its non-``is_system``
--   branch is ORG-GATED, mirroring the mig-109 skill_files TABLE RLS shape verbatim.
--   VALUE-PRESERVING for platform built-ins: the ``is_system`` universal escape keeps the
--   built-in skill-creator's bundled files cross-org readable (mig-109 FIX-A / D-165-02);
--   only the previously-unbounded ``is_org_shared`` branch is narrowed to the caller's org.
--
-- WHY (the gap SEED-125 CR-02 names):
--   The mig-111 §3 storage policy set the shared read branch to
--       (s.is_system = true OR s.is_org_shared = true)
--   with NO ``org_id`` predicate. Its comment claimed this "reconciles to the mig-109
--   skill_files table-RLS shape", but the mig-109 TABLE policy ORG-GATES its non-is_system
--   branch (``org_id IN (SELECT public.current_user_org_ids()) AND (owner OR is_org_shared)``)
--   whereas this STORAGE policy did not. Under a normal authenticated user's JWT (storage RLS
--   applies), a user in org B could therefore read the storage BYTES of ANY org's is_org_shared
--   skill files cross-org — the storage-read sibling of the CR-01 service-role tool leak. The
--   "reconciled" comment overstated the closure; this migration makes it true.
--
--   Correct predicate (mirrors mig-109 skill_files SELECT + the CR-01 tool-dispatcher fix):
--       s.is_system = true
--       OR (s.org_id IN (SELECT public.current_user_org_ids())
--           AND (s.user_id = auth.uid() OR s.is_org_shared = true))
--   The storage policy runs under the AUTHENTICATED user JWT (not the service role), so
--   ``current_user_org_ids()`` + ``auth.uid()`` resolve directly — no need for the
--   producer-side ``org_members`` resolution CR-01 uses on the BYPASSRLS client.
--
-- WHAT IS UNTOUCHED:
--   * The owner-folder read leg ((storage.foldername(name))[1] = auth.uid()::text) — a user
--     always reads files under their OWN storage prefix; kept verbatim.
--   * The INSERT / DELETE skill-files storage policies (owner-prefix only, no old-flag ref).
--   * The documents / sandbox-outputs / workspace-files bucket policies (owner-only).
--
-- IDEMPOTENT: DROP POLICY IF EXISTS + CREATE POLICY (Postgres has no CREATE-OR-REPLACE for
--   policies) — re-paste-safe. Pure storage.objects DDL, no data movement.
--
-- ── APPLY DISCIPLINE (CLAUDE.md) — AUTHORED HERE, OPERATOR-APPLIED ──────────────────────────────
--   NOT applied in this change. Applied LOCAL by the OPERATOR pasting this whole file into the
--   Supabase SQL editor @ :54322 as ONE execution (pure DDL, BEGIN…COMMIT is fine) — AFTER 111.
--   NEVER ``supabase db push`` / ``db reset`` (preserves dev data). AFTER applying: run
--   ``bash scripts/regenerate-full-schema.sh`` (NO --reset — live-DB dump) and commit this
--   migration + the regenerated supabase/full-schema.sql together. NEVER hand-edit
--   full-schema.sql. The matching scripts/full-schema-supplement.sql §2 skill-files read policy
--   is updated in the SAME commit as this migration so a greenfield paste is org-gated too.
--
-- ── CLOUD PARITY / DEPLOYMENT-ARTIFACT PARITY ───────────────────────────────────────────────────
--   112 joins the pending cloud set (099 → … → 111 → 112), applied to production only at the next
--   operator-gated push, in order. Storage-RLS policy DDL only — seeds NO reference data, touches
--   NO env var / bundled service / sandbox tag — so it is NOT seed-bearing and owes NO
--   docs/OPERATOR.md or check-deploy-drift.sh change (D-16 satisfied by exclusion, as migs 108–111).

BEGIN;

-- ================================================================================================
-- §1 — skill-files Storage READ policy: org-gate the shared branch (mirror mig-109 skill_files RLS)
--   The is_system branch stays a UNIVERSAL escape OUTSIDE the org gate (built-in skill-creator
--   files are legitimately cross-org). The is_org_shared branch is now gated on
--   org_id ∈ current_user_org_ids() (+ the owner OR is_org_shared disjunction), so a disjoint-org
--   user can no longer read another org's org-shared skill file bytes. Owner-prefix leg unchanged.
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
        WHERE sf.file_path = name
          AND (
            s.is_system = true
            OR (
              s.org_id IN (SELECT public.current_user_org_ids())
              AND (s.user_id = (select auth.uid()) OR s.is_org_shared = true)
            )
          )
      )
    )
  );

COMMIT;

-- Closing note: 112 org-gates the shared branch of the skill-files Storage READ policy so it
-- matches the mig-109 skill_files TABLE RLS (is_system universal OUTSIDE the gate; the
-- owner/is_org_shared branch INSIDE org_id ∈ current_user_org_ids()) — closing the CR-02 storage
-- sibling of the SEED-125 CR-01 service-role tool leak. Value-preserving for is_system built-ins;
-- narrows only the previously-unbounded is_org_shared branch. Idempotent DROP+CREATE, one
-- BEGIN/COMMIT atomic. Apply AFTER 111; then regenerate full-schema no-reset + commit both
-- same-commit (the full-schema-supplement.sql §2 copy is updated in this same commit). 112 joins
-- the pending cloud set (099→112) — not applied to cloud now.
