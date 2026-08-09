---
phase: 161-org-dept-role-schema
verified: 2026-07-18T17:13:49Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
---

# Phase 161: Org / Dept / Role Schema Verification Report

**Phase Goal:** Ship the org/dept/role/membership schema with RLS + the recursion-safe helper from day one (ORG-01, ORG-02).
**Verified:** 2026-07-18T17:13:49Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a Supabase Postgres migration phase. Per the phase-specific verification instructions, SUMMARY.md claims and "types compile" were treated as zero evidence. All assertions below were re-derived independently:

- Read `supabase/migrations/104_org_dept_role_schema.sql` in full (539 lines) and cross-checked every table/policy/function against the PLAN frontmatter must-haves.
- Connected to the LIVE local Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) via the backend venv's `psycopg2` (`backend/venv/Scripts/python.exe`), run through throwaway scripts in the OS temp scratchpad (never in `backend/`), and independently re-ran every live assertion the plans claimed — including re-executing the headline 42P17 non-recursion test myself rather than trusting the SUMMARY's captured output.
- Verified git history for every commit hash cited in the SUMMARYs (`65b2af18`, `e98be4f6`, `97fe513b`, `0a9f6ea3`, `07bf6a4e`) with `git show --stat` to confirm file-level contents match the claims.
- Ran `bash scripts/check-deploy-drift.sh` myself (did not accept the SUMMARY's reported exit code).
- Grepped the migration file and all phase docs for debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) and stub language.
- Cross-referenced `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` independently for requirement traceability and orphan detection.

## Goal Achievement

### ROADMAP Success Criteria (the authoritative contract)

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | The 8 org tables ship (organizations w/ subscription_tier+add_ons jsonb, departments w/ parent_id self-FK + default dept, org_members, dept_members, roles+role_permissions 4-tier, org_invitations, sso_configs) — all with RLS, FKs, indexes from creation. | VERIFIED | Live: `to_regclass` non-null for all 8 + `pg_class.relrowsecurity=true` for all 8 (independently queried). File: all 8 `CREATE TABLE IF NOT EXISTS` blocks present with PK/FK/timestamps as specified. |
| 2 | `current_user_org_ids()` SECURITY DEFINER helper + non-recursive self-rows-only `org_members` policy exist; a live authenticated query against `org_members` does NOT raise `42P17`; every other table's membership predicate calls the helper. | VERIFIED | Live: independently re-ran `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=...; SELECT count(*) FROM public.org_members` → returned `0`, no exception raised, no SQLSTATE 42P17. Live: `pg_proc.prosecdef=true` for `current_user_org_ids`. Exhaustively pulled all 25 live `pg_policies` rows — zero policies outside `org_members` itself reference `org_members` directly; all route through `current_user_org_ids()`/`current_user_has_permission()`. |
| 3 | Nullable `org_id` is present on every remaining user-facing table (23 tables), added additively, byte-identical. | VERIFIED | Live: queried the full 23-table sweep set (not just the 4-table sample) — all 23 found with `org_id`, all `is_nullable='YES'`, zero FK constraints on any swept `org_id` column. Exclusions (`document_chunks`, `skill_embeddings`, 4 system/identity tables) confirmed absent live. |
| 4 | A 5-person team and a 2,000-person org are served by the SAME schema — small orgs never touch `dept_members`; large orgs nest via `departments.parent_id` — zero schema change either way. | VERIFIED | Structural: `departments.parent_id` is a nullable self-FK (live constraint `departments_parent_id_fkey` confirmed, column nullable); `dept_members` is a separate, independently-optional table — no constraint forces its use. This is a schema-flexibility claim appropriate to verify structurally at this (empty-table, foundation) phase; behavioral load-testing is out of scope for a zero-behavior-change migration. |

**Score:** 4/4 roadmap success criteria verified.

### Detailed Must-Haves (from both PLAN frontmatters, merged)

| # | Truth (source) | Status | Evidence |
|---|---|---|---|
| 1 | `organizations` carries `subscription_tier`, `add_ons jsonb NOT NULL DEFAULT '{}'`, and a SEPARATE `settings jsonb NOT NULL DEFAULT '{}'` (161-01, D-01) | VERIFIED | File lines 55-66: all three columns present and distinct, each with its own COMMENT. Live: `information_schema` not re-queried for this (file evidence sufficient — no ambiguity possible in DDL text). |
| 2 | 4-tier CHECK on `org_members.role`/`dept_members.role`/`org_invitations.role` = super-admin/org-admin/dept-admin/member; `org_invitations.status` CHECK = pending/accepted/expired/revoked (161-01) | VERIFIED | File lines 93, 108, 140, 142 — all four CHECK constraints present with exact value sets. Live: `pg_constraint` confirms `org_members_role_check`, `dept_members_role_check`, `org_invitations_role_check`, `org_invitations_status_check` all exist. |
| 3 | `current_user_org_ids()` authored `SECURITY DEFINER` + `SET search_path TO 'public'`, body reads `org_members WHERE user_id = auth.uid()` (161-01, ORG-02/D-10) | VERIFIED | File lines 175-181. Live: `prosecdef=true`. |
| 4 | `org_members` SELECT is self-rows-only, NO `org_members` subquery anywhere; org-admin read path routes through the helper (161-01, D-10) | VERIFIED | Live: `org_members_self_select` USING clause = `(user_id = auth.uid())` — direct column compare, no subquery. Exhaustive live scan of all 25 policies found zero raw `org_members` references outside the org_members table's own policies. |
| 5 | `roles` + `role_permissions` are global reference data: read-all `USING (true)` + NO write policy (161-01, D-04/T-161-03) | VERIFIED | Live: `policy_counts` shows exactly 1 policy each for `roles` and `role_permissions`, both `SELECT ... USING (true)`, zero INSERT/UPDATE/DELETE policies present. |
| 6 | `departments.is_default boolean` + partial-unique index (one default per org) + `create_org_with_default_dept()` SECDEF helper (161-01, D-11) | VERIFIED | Live: `departments_one_default_per_org_idx` exists with definition `... USING btree (org_id) WHERE (is_default = true)`. `create_org_with_default_dept` live `prosecdef=true`. |
| 7 | Permission catalog seeded: 4 fixed roles + tiered grants over 5 keys (super-admin=5, org-admin=3, dept-admin=1, member=0/absent) (161-01, D-02/D-03) | VERIFIED | Live: `roles` count = 4. `role_permissions` grouped by role = super-admin:5, org-admin:3, dept-admin:1 (member absent). Matches D-02 matrix exactly. |
| 8 | `org_invitations` stores `token_hash` (never plaintext); `sso_configs` is deliberately thin, no invented SAML columns (161-01, D-06/D-07) | VERIFIED | File: `org_invitations.token_hash text NOT NULL`, no `token` plaintext column. `sso_configs` has only `org_id`/`email_domain`/`provider_id`/`attribute_mapping`/timestamps — no cert/xml/metadata columns (grep for `cert\|saml_xml\|idp_metadata\|x509` returns nothing in the block). |
| 9 | Membership-correct RLS authored on all 8 new tables, idempotency guards present (161-01, D-08/D-09) | VERIFIED | Live: RLS enabled (`relrowsecurity=true`) on all 8. 25 total policies live, matching the 25 `DROP POLICY IF EXISTS` / `CREATE POLICY` pairs in the file. |
| 10 | Nullable `org_id` swept onto 23 tables + btree index + forward-compat comment; 2 Phase-163-deferred + 4 system/identity tables excluded (161-01, SC#3/D-05) | VERIFIED | Live: all 23 present (0 missing), all nullable, 0 FK violations, all 23 `idx_<t>_org_id` indexes present. Excluded set (`document_chunks`, `skill_embeddings`, `app_settings`, `model_capabilities_overrides`, `operator_users`, `profiles`) confirmed absent live. |
| 11 | 13 pre-existing org_id tables untouched; schema serves both org scales (161-01, SC#4) | VERIFIED | Live: all 13 (`classification_rules`, `document_relationships`, `document_views`, `documents`, `folders`, `harness_audit`, `metadata_field_definitions`, `operator_audit_log`, `skills`, `threads`, `workflow_definitions`, `workflow_phases`, `workflow_runs`) still carry `org_id`. |
| 12 | LIVE 42P17 non-recursion proof against the running DB (161-02, SC#2/ORG-02/D-10) | VERIFIED | Independently re-executed (not copy-pasted from SUMMARY): `SET LOCAL ROLE authenticated` + JWT claim + `SELECT count(*) FROM public.org_members` → `0`, no exception, no SQLSTATE 42P17. |
| 13 | LIVE: all 8 org tables exist with RLS enabled (161-02, SC#1/ORG-01) | VERIFIED | Independently queried `to_regclass`/`pg_class.relrowsecurity` — all 8 non-null/true. |
| 14 | LIVE: `current_user_org_ids()` exists as SECURITY DEFINER (161-02, ORG-02/D-10) | VERIFIED | `pg_proc.prosecdef = true` (plus the other 2 helpers, also true). |
| 15 | LIVE: permission catalog seeded (161-02, D-02) | VERIFIED | `roles` count=4; grant distribution matches matrix (see #7). |
| 16 | LIVE: swept tables carry `org_id`, exclusions do NOT (161-02, SC#3) | VERIFIED | See #10 — full 23-table set + exclusion set both independently confirmed live. |
| 17 | `supabase/full-schema.sql` regenerated via script, never hand-edited, reflects head 104 (161-02, D-01/CLAUDE.md) | VERIFIED | `full-schema.sql` contains all 8 `CREATE TABLE public.*` + all 3 `CREATE FUNCTION public.*` objects. Git history: `0a9f6ea3` (chore, regen only) + `07bf6a4e` (fix, touches both migration + full-schema.sql together) — content diffed byte-for-byte matches the migration's policy text. See note below on commit granularity. |
| 18 | ADR SC#4: local setup boots unchanged, no deployment tier made harder — additive only (161-02) | VERIFIED | Confirmed via `git show --stat` on all 5 phase commits (`65b2af18`,`e98be4f6`,`97fe513b`,`0a9f6ea3`,`07bf6a4e`): only `supabase/migrations/104_org_dept_role_schema.sql` and `supabase/full-schema.sql` were ever touched — zero backend/frontend application code changed. New tables are empty (row counts confirmed live: 0 for all except roles=4/role_permissions=9 seed rows); swept columns are nullable with no FK. |
| 19 | Post-summary hardening — CR-01: `create_org_with_default_dept()` EXECUTE revoked from PUBLIC/anon/authenticated, granted to service_role only | VERIFIED | Live: `has_function_privilege('authenticated', ...) = false`, `('anon', ...) = false`, `('service_role', ...) = true`. Confirmed in commit `07bf6a4e` (verified this is a real commit, not a SUMMARY claim). |
| 20 | Post-summary hardening — CR-02: `org_members`/`dept_members` INSERT/UPDATE block `role='super-admin'` self-escalation | VERIFIED | Live: all 4 policies (`org_members_insert`, `org_members_update`, `dept_members_insert`, `dept_members_update`) `WITH CHECK` clauses contain `role <> 'super-admin'`. 42P17 proof still holds (test #12) — the fix did not reintroduce recursion. |

**Score:** 20/20 must-haves verified.

**Note on must-have #17 (commit granularity):** 161-02-PLAN.md's literal acceptance criterion asked for the migration + full-schema.sql to land in exactly one commit. In practice the migration was already committed via Plan 01's three atomic task-commits before Plan 02 ran (this project's GSD workflow auto-commits per task), so Plan 02's regeneration step landed in its own commit (`0a9f6ea3`, full-schema.sql only) rather than re-including the unchanged migration file. This is the same "regenerate-full-schema-after-apply" split-commit convention already established at `159-03`/`158-12`/`150-02`/`149-01` in this repo's own history (cited directly in the SUMMARY). Verified there is zero drift between the migration and `full-schema.sql` at HEAD (confirmed by diffing the CR-02 policy text in both files — identical), and the later `07bf6a4e` fix commit does land both files together in one commit as literally specified. Judged as satisfied-by-intent, not a gap — the substantive parity/no-hand-edit guarantee holds at every point in the phase's history.

### Deferred Items

Findings from `161-REVIEW.md` (code review) that are explicitly scoped to later phases, not gaps in Phase 161's own must-haves:

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | WR-01: `dept_members.org_id` denormalization not validated against `dept_id`'s true org (composite FK needed) | Phase 163 | 161-REVIEW.md: "fold into the RLS crux + 164 two-org isolation suite." Phase 163 goal = "RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX"; Phase 164 TEN-05 = "cross-org isolation test suite... two seeded orgs × every user-facing table... (0 cross-org rows)" — directly covers this class of defect. |
| 2 | IN-01: `departments.parent_id` not constrained to the same org (cross-org tree edge possible) | Phase 163 | Same fold-in as WR-01 (161-REVIEW.md); matches the existing `folders.parent_id` precedent deliberately copied. |
| 3 | IN-02: `org_invitations.token_hash` has no UNIQUE index | Phase 167 | 161-REVIEW.md: "redemption is Phase 167." Phase 167 = invitations/JIT-provisioning lifecycle phase per ROADMAP. |
| 4 | IN-03: `org_invitations.invited_by` has no FK to `auth.users` | Phase 167 | Same — invitation lifecycle is Phase 167's scope. |
| 5 | Invited-role ceiling (`org_invitations.role` can invite above one's own role) | Phase 167 | 161-REVIEW.md: "invited-role validation belongs with 167 JIT/redemption design." |

These do not affect Phase 161's status — they are Warning/Info-level code-review findings on hardening beyond the phase's stated scope, explicitly deferred with named target phases and reasons already documented in `161-REVIEW.md` before this verification ran.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/104_org_dept_role_schema.sql` | Single additive migration: 8 org tables + 3 SECDEF helpers + membership-correct RLS + permission-catalog seed + 23-table org_id sweep | VERIFIED | 539 lines. Exists, substantive (no stubs/TODOs — grep for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER returns zero matches), applied live (confirmed via to_regclass/pg_proc/pg_policies), amended by `07bf6a4e` for the two Critical review fixes. |
| `supabase/full-schema.sql` | Regenerated single-file bootstrap dump containing the 8 org tables + `current_user_org_ids()` at head 104 | VERIFIED | Contains all 8 `CREATE TABLE public.*` + all 3 `CREATE FUNCTION public.*` objects (grep-confirmed). Regenerated via `scripts/regenerate-full-schema.sh`, never hand-edited (git history shows only script-driven diffs — 1016 insertions/15 deletions in the initial regen, consistent with a schema dump reordering, not manual edits). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `current_user_org_ids()` | `public.org_members` | SECDEF body: `SELECT org_id FROM public.org_members WHERE user_id = auth.uid()` | WIRED | File + live confirmed; the function is `prosecdef=true` so this internal read bypasses `org_members`' own RLS (the recursion-break mechanism), proven live by the 42P17 test succeeding. |
| Org-scoped table RLS policies (departments/dept_members/org_invitations/sso_configs/organizations) | `current_user_org_ids()` | Read predicate `org_id IN (SELECT public.current_user_org_ids())` | WIRED | Live: exhaustively confirmed on all non-org_members SELECT policies (7 read policies use this exact pattern). |
| `org_members`/`dept_members` write policies | `current_user_has_permission()` | `WITH CHECK` role gate + `role <> 'super-admin'` | WIRED | Live: confirmed on all 4 relevant policies (post-CR-02-fix). |
| `departments.is_default` | Partial-unique index | `departments_one_default_per_org_idx ... WHERE (is_default = true)` | WIRED | Live: index exists with exact expected definition. |
| Operator SQL-editor apply | Live local DB (port 54322) | Paste + run `104_org_dept_role_schema.sql` | WIRED | Confirmed — all objects exist live; row counts on new tables (0 except seed rows) prove the migration ran, not just that the file exists. |
| `scripts/regenerate-full-schema.sh` | `supabase/full-schema.sql` | Live-DB dump (no reset) | WIRED | Git diff of `0a9f6ea3` shows exactly the expected schema additions; no hand-editing markers. |
| `create_org_with_default_dept()` EXECUTE grants | `service_role` only | `REVOKE ... FROM PUBLIC/anon/authenticated` + `GRANT ... TO service_role` | WIRED | Live `has_function_privilege` checks confirm the grant boundary exactly as claimed. |

### Data-Flow Trace (Level 4)

Not directly applicable in the UI-rendering sense (this phase ships no application code), but the analogous check — does the seeded reference data actually populate as real rows rather than stub/empty values — was run:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `roles` table | seed rows | Migration `INSERT ... ON CONFLICT DO NOTHING` | Live count = 4 (not 0/empty) | FLOWING |
| `role_permissions` table | seed rows | Migration `INSERT ... ON CONFLICT DO NOTHING` | Live count = 9, grouped distribution matches the D-02 matrix exactly (not a flat/wrong count) | FLOWING |
| 8 new org tables | row data | N/A — intentionally empty at this phase (backfill is Phase 162) | Live counts = 0 for all 8 except the 2 seed tables | FLOWING (empty-by-design, confirmed not accidentally populated or broken) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 42P17 non-recursion (the headline proof) | `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=...; SELECT count(*) FROM public.org_members` via psycopg2 | Returned `0`, no exception, no SQLSTATE 42P17 | PASS |
| All 8 tables exist + RLS enabled | `to_regclass` + `pg_class.relrowsecurity` query | All 8 non-null / true | PASS |
| 3 SECDEF helpers | `pg_proc.prosecdef` query | All 3 = true | PASS |
| Seed catalog correctness | `SELECT count(*) FROM roles`; `SELECT role, count(*) FROM role_permissions GROUP BY role` | 4; super-admin=5/org-admin=3/dept-admin=1 | PASS |
| Full 23-table org_id sweep + exclusions | `information_schema.columns` query against all 23 + all 6 excluded tables | 23/23 present, 0/6 wrongly present | PASS |
| CR-01 execute-privilege lockdown | `has_function_privilege(...)` for authenticated/anon/service_role | F/F/T | PASS |
| CR-02 self-escalation guard | `pg_policies.with_check` text search for `super-admin` on 4 policies | Present on all 4 | PASS |
| Deploy-artifact drift check | `bash scripts/check-deploy-drift.sh` (re-run independently) | Exit 0 — PASS, 2 non-blocking WARNs (seed-list human-review + docker-compose sandbox fallback) | PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` exist for this phase, and none are referenced in the PLAN/SUMMARY files. Step 7c: SKIPPED (no probe convention for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ORG-01 | 161-01, 161-02 | The org/dept/role/membership schema ships (8 tables, RLS/FK/indexes from creation) | SATISFIED | See Success Criteria #1 and Must-Haves #1-11, #13. Live-verified, not just authored. |
| ORG-02 | 161-01, 161-02 | `current_user_org_ids()` SECDEF helper + non-recursive policy prevent 42P17; every other table's predicate calls the helper | SATISFIED | See Success Criteria #2 and Must-Haves #3, #4, #12, #14. Independently re-executed the 42P17 test myself. |

**Orphaned requirements check:** `.planning/REQUIREMENTS.md` maps only `ORG-01` and `ORG-02` to Phase 161 (lines 116-117 of the requirements table; both already marked `[x]`/Complete). No additional requirement ID maps to Phase 161 that isn't claimed in a PLAN's `requirements` frontmatter. None orphaned.

### Anti-Patterns Found

None. Grepped `supabase/migrations/104_org_dept_role_schema.sql` and all phase docs (`161-01-SUMMARY.md`, `161-02-SUMMARY.md`, `161-REVIEW.md`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and stub language (`placeholder|coming soon|will be here|not yet implemented|not available`) — zero matches in all files. The migration file's inline comments reference future phases (162/163/164/167/168/169) for deliberately deferred work, but every reference names a concrete phase number, satisfying the "formal follow-up reference" exemption in the debt-marker gate — none are bare/unreferenced markers.

### Human Verification Required

None. This phase ships no UI or application-code change — every must-have is a database object (table/policy/function/index/seed row) independently verifiable via live SQL queries, which were run directly against the running local Postgres rather than relying on visual inspection or SUMMARY narration. No CLAUDE.md workflow guardrail (G-1 through G-6) fires for this phase — it touches no hot files from the ledger and no UI surface.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria and all 20 detailed must-haves (11 from 161-01 + 7 from 161-02 + 2 post-summary security-hardening truths explicitly called out for re-verification) are independently VERIFIED against the live database and git history — not accepted on SUMMARY.md narration alone. The two Critical findings from code review (CR-01 unguarded RLS-bypassing RPC, CR-02 super-admin self-escalation) were confirmed fixed and live-verified in commit `07bf6a4e`. Five lower-severity review findings (WR-01, IN-01, IN-02, IN-03, invite-ceiling) are explicitly deferred to Phases 163/164/167 with named targets already recorded in `161-REVIEW.md` — informational, not phase-161 gaps. Zero application code was touched across all 5 phase commits, consistent with the "zero behavior change on creation" claim. Phase 161's goal — shipping the org/dept/role/membership schema with RLS and the recursion-safe helper from day one — is achieved and independently proven against the running system.

---

_Verified: 2026-07-18T17:13:49Z_
_Verifier: Claude (gsd-verifier)_
