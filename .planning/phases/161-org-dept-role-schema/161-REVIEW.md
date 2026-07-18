---
phase: 161-org-dept-role-schema
reviewed: 2026-07-18T16:47:32Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - supabase/migrations/104_org_dept_role_schema.sql
findings:
  critical: 2
  warning: 1
  info: 3
  total: 6
status: issues_found
---

# Phase 161: Code Review Report

**Reviewed:** 2026-07-18T16:47:32Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed the foundational v3.4 multi-tenancy migration `104_org_dept_role_schema.sql` (ORG-01/ORG-02): 8 org tables, 3 SECURITY DEFINER helpers, membership-correct RLS, a seeded permission catalog, and a 23-table nullable `org_id` sweep.

**What holds (verified against the review focus):**

- **Cross-tenant read/write isolation holds once populated.** Every org-scoped SELECT gates on `org_id IN (SELECT public.current_user_org_ids())` (and `id IN (...)` for `organizations`). Every INSERT/UPDATE write policy carries a `WITH CHECK` pinning `org_id`/`id` to the caller's orgs. No policy lets org A read or write org B rows.
- **The 42P17 contract is clean.** The only reads of `org_members` are inside the two SECDEF function bodies; the sole direct predicate on `org_members` (`org_members_self_select`) is a column compare (`user_id = auth.uid()`) with no subquery. No policy inlines an `org_members` subquery.
- **SECDEF hardening is complete.** All 3 helpers are `SECURITY DEFINER` + `SET search_path TO 'public'`, and all internal table references are schema-qualified (`public.*`, `auth.uid()`).
- **Reference-table lockdown holds.** `roles` and `role_permissions` have read-all + zero write policies (RLS enabled).
- **Idempotency / re-paste safety is clean.** `CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before every `CREATE POLICY`, `ON CONFLICT DO NOTHING` on both seeds, `ADD COLUMN IF NOT EXISTS` on the sweep. No statement would error on a second paste.
- **Sweep byte-identity holds.** All 23 swept `org_id` columns are nullable `uuid`, no FK, no NOT NULL. Sweep set does not overlap the 13 already-org_id tables (cross-checked against migration 096, which seeded documents/folders/threads/skills).
- **CHECK enums + token_hash correct.** 4-tier role vocab and invitation status vocab are consistent across all tables; `org_invitations` stores `token_hash` with no plaintext token column.

**Key concerns (what empty-table live verification did NOT catch):** Two security defects that only manifest once the tables are populated and the PostgREST surface is exercised — an RLS-bypassing org-creation RPC that is callable by any (even unauthenticated) caller with no authorization guard, and a role self-escalation path through the `org_members` write policies that **directly falsifies the plan's own T-161-03 guarantee** ("an org-admin cannot grant themselves super-admin perms"). Both are baked into the "correct-from-birth" RLS layer (D-08) and must be closed before member-write paths land in 164/166/167.

## Critical Issues

### CR-01: `create_org_with_default_dept()` is an unguarded, RLS-bypassing write callable by any (even unauthenticated) role

**File:** `supabase/migrations/104_org_dept_role_schema.sql:206-227`
**Issue:**
`create_org_with_default_dept()` is `SECURITY DEFINER` (so its `INSERT`s into `organizations` + `departments` bypass RLS), but it has **no internal authorization check** (no `auth.uid()` gate, no permission check) and the migration issues **no `REVOKE EXECUTE`**. Under Supabase's default public-schema grants, functions are `EXECUTE`-able by `anon` and `authenticated`, and every public function is exposed as a PostgREST RPC. So any caller can invoke:

```
POST /rest/v1/rpc/create_org_with_default_dept
{ "p_name": "x" }
```

and create organizations + departments at will, bypassing the deliberately-conservative "no INSERT policy on `organizations`" design (line 279-280). `organizations` has no user-JWT INSERT policy precisely so that org creation flows only through this function — which makes this the *sole* creation path, and it is ungated. This is exactly the class of defect empty-table verification misses: the live check confirmed `prosecdef=true` but never exercised the grant/authz.

Impact is bounded (the function inserts no `org_members` row, so the caller creates *orphan* orgs invisible to themselves — it is a spam / resource-exhaustion vector, not a cross-tenant data breach), but an unauthenticated, RLS-bypassing write in the security-foundation migration is a must-fix pattern. (The other two SECDEF helpers are safe-by-content: they are read-only and key off `auth.uid()`, so `anon` gets empty/false.)

**Fix:** Lock execution down in the same migration (belt-and-suspenders with an internal guard). At minimum:

```sql
REVOKE ALL ON FUNCTION public.create_org_with_default_dept(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_with_default_dept(text, text, text) TO service_role;
```

Or add an internal authorization gate (e.g. `IF auth.uid() IS NULL THEN RAISE EXCEPTION ...` plus whatever provisioning rule 162/167 will enforce), or defer authoring the function to the 162/167 boundary where its creation-seam is actually wired. Whichever path, the RPC must not be anon/authenticated-callable as shipped.

### CR-02: `org_members` write policies permit role self-escalation to `super-admin` — falsifies the T-161-03 "cannot grant themselves super-admin" guarantee

**File:** `supabase/migrations/104_org_dept_role_schema.sql:263-276` (and `280-289`, `337-340` for related mint paths)
**Issue:**
`org_members_update` gates on `current_user_has_permission(org_id, 'org:manage')` and its `WITH CHECK` pins `org_id` to the caller's orgs — but it places **no constraint on the `role` column**, and the column `CHECK` (line 93) permits `'super-admin'`. So any `org:manage` holder (i.e. an org-admin) can escalate their own membership:

```
PATCH /rest/v1/org_members?user_id=eq.<self>&org_id=eq.<my-org>
{ "role": "super-admin" }
```

- USING passes (`org:manage` is true for their own org's rows).
- WITH CHECK passes (`org_id` unchanged, still their org).
- The column CHECK accepts `'super-admin'`.

`org_members_insert` (263-266) and `org_invitations_insert` (337-340) are the same door: an `org:manage`/`org:invite` holder can *mint* a `super-admin` grant for anyone. This **directly contradicts the plan's stated security invariant** (`161-01-PLAN.md:151`, T-161-03: "an org-admin cannot grant themselves super-admin perms"), which the plan believed was fully secured by write-locking `roles`/`role_permissions`. Locking the reference tables does not help when the *membership* table's write policy hands out the top tier.

Effective gain today is org-scoped (`super-admin` adds `dept:manage` + `sso:manage` over org-admin, and both are gated per-org). But the seed labels `super-admin` "**Cross-org system administrator — all permissions**" (line 388): any later phase that treats `org_members.role = 'super-admin'` as a global/cross-org signal turns this into a full cross-tenant privilege escalation. Because this is the "correct-from-birth" RLS layer (D-08) that gates the write paths landing in 164/166, the hole must be closed before those paths ship.

**Fix:** Forbid user-JWT writes from setting/keeping a tier above the caller's own (only SECDEF/service_role may mint `super-admin`), and forbid self-role-change. A `WITH CHECK` cannot see the pre-image on UPDATE, so enforce with a `BEFORE INSERT OR UPDATE` trigger on `org_members` (and `org_invitations`), e.g.:

```sql
CREATE OR REPLACE FUNCTION public.enforce_role_grant_ceiling()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- only a super-admin of the org (or service_role/SECDEF bootstrap) may create/keep a super-admin grant
  IF NEW.role = 'super-admin'
     AND NOT public.current_user_has_permission(NEW.org_id, 'org:grant_super_admin') THEN
    RAISE EXCEPTION 'insufficient privilege to grant super-admin';
  END IF;
  -- forbid changing your own role
  IF TG_OP = 'UPDATE' AND NEW.user_id = auth.uid() AND NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'cannot change your own role';
  END IF;
  RETURN NEW;
END; $$;
```

(seed the new `org:grant_super_admin` key only to `super-admin`). Alternatively, drop `'super-admin'` from the `org_members`/`org_invitations` column CHECK entirely if org-scoped super-admin is never meant to be JWT-mintable.

## Warnings

### WR-01: `dept_members.org_id` is denormalized and RLS-trusted, but never validated against `dept_id`'s true org

**File:** `supabase/migrations/104_org_dept_role_schema.sql:103-115` (table), `312-330` (policies)
**Issue:**
`dept_members` carries a denormalized `org_id` *specifically so RLS can gate it without joining `departments`* (D-10, line 101-102). But nothing constrains `org_id` to equal the org that `dept_id` actually belongs to — the FKs on `dept_id` and `org_id` are independent. The write policies pin `org_id` to the caller's orgs, not to `dept_id`'s org, so an `org:manage` holder in org A can insert:

```
{ "org_id": "<A>", "dept_id": "<a department in org B>", "user_id": "..." }
```

This row passes every policy (`org_id = A` is in the caller's orgs) yet references org B's department. `dept_members` is inert for authorization in *this* migration (no policy/function reads it), so the poison is latent — but Phase 163 wires dept-scoped access on exactly this trusted denormalized `org_id`, at which point a mismatched row becomes an authorization/integrity hole. Must be fixed before 163 consumes the column.

**Fix:** Make the denormalization structurally impossible to violate with a composite FK. Add a unique key on `departments(id, org_id)` and repoint `dept_members`:

```sql
ALTER TABLE public.departments ADD CONSTRAINT departments_id_org_unique UNIQUE (id, org_id);
-- replace the standalone dept_id FK with a composite one:
ALTER TABLE public.dept_members
  ADD CONSTRAINT dept_members_dept_org_fk
  FOREIGN KEY (dept_id, org_id) REFERENCES public.departments (id, org_id) ON DELETE CASCADE;
```

This guarantees `dept_members.org_id` always matches the department's org. (Keep it idempotent — guard with `IF NOT EXISTS` / `DO $$ ... $$` on re-paste.)

## Info

### IN-01: `departments.parent_id` is not constrained to the same org (cross-org tree edges possible)

**File:** `supabase/migrations/104_org_dept_role_schema.sql:76`, `297-306`
**Issue:** `parent_id` is a self-FK with only a `no_self_parent` CHECK; the insert/update policies pin the row's own `org_id` but not the parent's. An `org:manage` holder in org A could set `parent_id` to a department in org B, producing a department tree that spans two tenants. Lower severity than WR-01 because `departments` RLS gates on the row's own `org_id` (not `parent_id`), so this is a tree-integrity oddity rather than an authz hole, and it matches the existing `folders.parent_id` precedent the plan deliberately copied. Still worth hardening before dept-tree traversal logic lands.
**Fix:** Reuse the `departments(id, org_id)` unique key from WR-01 and make `parent_id` a composite FK: `FOREIGN KEY (parent_id, org_id) REFERENCES public.departments (id, org_id) ON DELETE CASCADE`, guaranteeing a parent shares the child's org.

### IN-02: `org_invitations.token_hash` has no UNIQUE constraint or index

**File:** `supabase/migrations/104_org_dept_role_schema.sql:141`
**Issue:** The table is shipped "near-complete" (D-06) and `token_hash` is the redemption lookup key, but there is no unique constraint or index on it. Redemption in Phase 167 will look up `WHERE token_hash = ...`; without a unique index two invitations could share a hash (astronomically unlikely for a random-token hash, but not enforced) and the lookup is a seq scan. Since the table is declared near-complete now, this is cheap to add here rather than in 167.
**Fix:** `CREATE UNIQUE INDEX IF NOT EXISTS org_invitations_token_hash_unique ON public.org_invitations USING btree (token_hash);` (or partial-unique scoped to `status = 'pending'` if reissue must reuse a hash slot).

### IN-03: `org_invitations.invited_by` has no FK to `auth.users`

**File:** `supabase/migrations/104_org_dept_role_schema.sql:144`
**Issue:** `invited_by uuid` is a bare column with no foreign key, inconsistent with every other user reference in the migration (`org_members.user_id`, `dept_members.user_id` both `REFERENCES auth.users(id) ON DELETE CASCADE`). It can therefore hold a UUID that references no real user, and it is not cleaned up when the inviter is deleted. Minor integrity/consistency gap on an otherwise near-complete table.
**Fix:** `invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL` (SET NULL, not CASCADE — deleting the inviter should not delete the invitation audit record).

---

_Reviewed: 2026-07-18T16:47:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
