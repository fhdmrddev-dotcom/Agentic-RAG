---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 03
subsystem: database / RLS
tags: [rls, multi-tenancy, membership, migration, security, ten-01, atomic-crux]
requires:
  - "migration 107 (org_id on document_chunks + skill_embeddings) — 108 references those columns; applies AFTER 107"
  - "migrations 104/105/106 (org tables + org_id backfill + BEFORE-INSERT autofill on the 37 tables)"
  - "helpers current_user_org_ids() (SETOF uuid, SECDEF, 42P17-safe) + folder_is_globally_visible() — already live"
provides:
  - "supabase/migrations/108_rls_membership_rewrite.sql — INERT membership-RLS rewrite of all 37 user-facing tables (97 policies, 6 sectioned clusters)"
  - "6 per-cluster RLS tests (backend/tests/integration/test_163_rls_*.py) — RED until plan 163-05 applies 107→108"
affects:
  - "plan 163-05 ([BLOCKING] Wave-3 apply: 107 THEN 108 via SQL editor, then regenerate full-schema)"
  - "the Wave-4 client swap (per-request user-JWT / SET LOCAL ROLE authenticated) — what FLIPS these predicates on"
  - "Phase 164 (SECDEF audit — retrieval RPC org-scoping), Phase 165 (is_global→is_system_global rename), Phase 166 (adds profiles.org_id for org roster visibility)"
tech-stack:
  added: []
  patterns:
    - "membership predicate: org_id IN (SELECT public.current_user_org_ids()) AND (owner [OR preserved global branch]) — copied verbatim from the live departments_* org-table template"
    - "re-paste-safe DDL: DROP POLICY IF EXISTS \"<exact live name>\" then CREATE POLICY (no CREATE OR REPLACE POLICY in Postgres); whole file BEGIN/COMMIT-atomic"
    - "inert-first atomic crux: all 37 tables in ONE migration, applied while BYPASSRLS bypasses every predicate; the Wave-4 client swap enforces it"
key-files:
  created:
    - supabase/migrations/108_rls_membership_rewrite.sql
    - backend/tests/integration/test_163_rls_documents.py
    - backend/tests/integration/test_163_rls_dm.py
    - backend/tests/integration/test_163_rls_chat.py
    - backend/tests/integration/test_163_rls_skills.py
    - backend/tests/integration/test_163_rls_workflow_eval.py
    - backend/tests/integration/test_163_rls_identity_audit.py
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "profiles kept owner-only (auth.uid()=id, NO membership macro) — it has no org_id column live; a membership prefix would abort apply (Rule 1/3 deviation)"
  - "global OR-branches preserved verbatim but now membership-gated; global rows visible to org co-members, not the whole install (post-162 personal orgs are singletons → == today's per-user behavior)"
  - "audit_log INSERT WITH CHECK carries an explicit org_id IS NULL branch (D-10) — forward-compat defense-in-depth (its org_id is NOT NULL live)"
metrics:
  duration: 11m
  completed: 2026-07-19
  tasks: 3
  commits: 3
  policies_rewritten: 97
  tables_rewritten: 37
  tests_added: 62
---

# Phase 163 Plan 03: RLS Membership Rewrite (Migration 108) Summary

Authored migration 108 — the TEN-01 predicate rewrite that transforms every RLS policy on all 37 target user-facing tables from the per-user form `auth.uid() = user_id` to the org-membership form `org_id IN (SELECT public.current_user_org_ids()) AND (<owner> [OR <preserved global branch>])`, using the proven departments_* template, shipped as ONE BEGIN/COMMIT-atomic migration with 6 clearly-sectioned per-cluster bundles (97 policies) that is INERT under today's BYPASSRLS connections — plus 6 per-cluster integration tests (RED until the plan-05 apply).

## What Was Built

**Task 1 — migration 108 sections 1-3 (`470eec07`):** documents (16 policies), DM (15), chat (29) clusters. Every live policy DROP-IF-EXISTS'd by its exact quoted name, re-created `TO authenticated` with the membership macro prepended. `folder_is_globally_visible` (documents/folders) and `is_global` (document_views/classification_rules/metadata_field_definitions) global branches preserved verbatim; the `is_global = false` INSERT/UPDATE WITH CHECK clauses kept; the parent-thread ownership subqueries (todos/workspace_files/workspace_file_versions) preserved and prefixed with membership. document_chunks predicates reference the org_id column migration 107 adds.

**Task 2 — migration 108 sections 4-6 + COMMIT (`6e27e2b7`):** skills (15), workflow-eval (18), identity-audit (4) clusters. skills `is_global` + skill_files/tuner_runs `EXISTS-on-skills` global branches preserved; workflow_definitions keyed off `created_by` (not user_id) with `is_global` preserved; workflow_phases/workflow_runs keep parent-thread ownership; skill_embeddings references migration 107's org_id. profiles special-cased (owner-only — see Deviations); audit_log carries the D-10 `org_id IS NULL` branch. File closes with a single `COMMIT;`.

**Task 3 — 6 per-cluster RLS tests (`8665b287`):** `test_163_rls_{documents,dm,chat,skills,workflow_eval,identity_audit}.py` (62 tests). Each encodes: (a) behavioral cross-org isolation under the real SET-LOCAL-as-user path + the fail-loud `assert_auth_uid` preflight; (b) a structural `current_user_org_ids` membership proof (the RED→GREEN signal); (c) for the 4 global-branch clusters, both a structural preservation assertion (the global expression survives) and a behavioral co-member regression (a global row renders for a same-org non-owner but NOT cross-org). chat + workflow-eval add parent-thread ownership-subquery preservation asserts; identity-audit pins the profiles owner-only invariant + audit_log membership + NULL branch.

## Verification

- **Structural (automated, this plan):** 97 CREATE POLICY == 97 DROP POLICY; exactly the 37 target tables covered (0 missing, 0 unexpected); **0 excluded tables** touched (departments/dept_members/organizations/org_members/org_invitations/sso_configs/operator_users/operator_audit_log all 0); zero `= ANY(`; zero `CREATE OR REPLACE POLICY`; balanced parens; all 97 `TO authenticated`; single BEGIN/COMMIT.
- **Tests collect cleanly:** `pytest tests/integration/test_163_rls_*.py --collect-only` → 62 collected, 0 errors.
- **RED contract confirmed real (not vacuous):** running the read-only structural membership assertions against the live (pre-108) schema FAILS 19/19 (current policies are `auth.uid()`-only) — they flip GREEN when plan 163-05 applies 107→108. The one green now (`test_profiles_is_owner_only_no_membership_macro`) is the intended special-case invariant that holds before and after.
- **Ordering:** 108 is authored to apply AFTER 107 (documented in-file "107 BEFORE 108"), because its document_chunks/skill_embeddings predicates reference the org_id column 107 adds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 / Rule 3 — blocking correctness] `profiles` cannot carry the membership prefix (no `org_id` column)**
- **Found during:** Task 2 (pre-authoring live schema probe of all 37 tables at head 107).
- **Issue:** The plan's action prose says "profiles uses `id = auth.uid()` as the owner branch + `org_id IN (SELECT current_user_org_ids())`". But `profiles` has **no `org_id` column** live (verified via `information_schema.columns` — migration 104 excluded it as the identity row keyed by `id = auth.uid()`; migration 107 does not add it either). Writing `org_id IN (...)` on profiles would reference a non-existent column and **abort the entire atomic rewrite at apply (plan 05)** with `column "org_id" does not exist` — breaking all 97 policies.
- **Fix:** profiles' 3 policies (INSERT/UPDATE/SELECT) re-created `TO authenticated` with the **owner branch only** (`auth.uid() = id`) — byte-identical self-only isolation, strictly more restrictive than a membership predicate, zero cross-org leak. This honors the plan's load-bearing must-have ("profiles uses id") and acceptance criterion ("profiles uses `id`"); only the inapplicable membership-prefix clause is dropped. Documented in the migration header + an inline §6 comment, and pinned by `test_163_rls_identity_audit.py::test_profiles_is_owner_only_no_membership_macro`.
- **Files modified:** supabase/migrations/108_rls_membership_rewrite.sql
- **Commit:** `6e27e2b7`
- **Downstream:** org-wide profile (roster) visibility is Phase 166, which will add `profiles.org_id` first, then widen the policy. Noted for the phase 164/166 context.

### Notes (followed the plan, recorded for the reviewer)

- **Migration slot 108 = RLS rewrite, 107 = TEN-04** — the plan/orchestrator authoritatively inverted the PATTERNS.md draft's "107=RLS / 108=TEN-04" pre-allocation because 108's document_chunks/skill_embeddings predicates depend on 107's org_id column. Followed the plan; not a deviation.
- **`audit_log.org_id` is NOT NULL live** (backfilled by mig 105), yet the D-10 `org_id IS NULL` branch was still added per the plan's explicit acceptance criterion — forward-compat defense-in-depth so genuinely org-agnostic operator/system audit rows are never rejected if a future migration relaxes the column. Followed the plan.

## Known Stubs

None in the problematic sense. The migration is **intentionally INERT** until plan 163-05 applies it and the Wave-4 client swap flips the connection to role `authenticated` — this "inert-first, all-37-in-one-file" design IS the atomic-crux safety property (D-06: never "policies now, client later" for a subset), not an unwired stub. TEN-01 enforcement/completion is therefore tracked at the phase apply gate (plans 05 + the client swap), not this authoring plan — which is why the TEN-01 requirement is deliberately left OPEN here (mirrors plan 02 leaving TEN-04 Pending until apply).

## Threat Flags

None. This plan IS the mitigation for the milestone's load-bearing security transition (T-163-02 predicate incompleteness / dropped global branch): all 37 tables land in one migration (no half-flip window), every global OR-branch preserved verbatim, per-cluster SELECT/INSERT/UPDATE/DELETE + regression tests, and the predicates call the SECDEF `current_user_org_ids()` helper (never inline an org_members subquery — the 42P17 recursion break). No new security-relevant surface introduced.

## Self-Check: PASSED

- Created files exist: 7/7 FOUND (migration + 6 test files).
- Commits exist: `470eec07`, `6e27e2b7`, `8665b287` all FOUND.
- Excluded tables (8 org + operator/catalog): 0 rewrites each — confirmed.
- Anti-patterns: 0 `= ANY(`, 0 `CREATE OR REPLACE POLICY`; 97 CREATE == 97 DROP; 37/37 tables.
- Tests: 62 collected cleanly; RED-until-apply contract confirmed live (19 structural fail vs pre-108 schema).
