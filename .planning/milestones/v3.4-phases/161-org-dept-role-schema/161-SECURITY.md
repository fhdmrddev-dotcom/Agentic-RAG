---
phase: 161
slug: org-dept-role-schema
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 161 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Scope: the single additive migration `supabase/migrations/104_org_dept_role_schema.sql`
> (8 org tables + 3 SECURITY DEFINER helpers + membership-correct RLS + seeded permission
> catalog + 23-table nullable `org_id` sweep). Verified against the committed post-fix file
> (commit `07bf6a4e`) AND the live local DB (Postgres 17.6, localhost:54322).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated user JWT → org-scoped RLS policies | A logged-in user's `auth.uid()` crosses into org table reads/writes. Untrusted intent: a member of org A reading/writing org B rows. Tables are empty until the 162 backfill / 163 client swap, but policies must be correct-from-birth (D-08). | org / dept / membership / invitation / SSO rows (tenant-scoped) |
| RLS policy → `org_members` self-reference | An `org_members` policy that reads `org_members` is the `42P17` infinite-recursion / table-lockout surface. | membership rows (auth-critical) |
| migration / service_role → `roles` / `role_permissions` | Only the migration (RLS-bypassing owner) may write the permission catalog; a user JWT must never write role tiers or grants. | RBAC reference data (privilege-defining) |
| SECURITY DEFINER function body → `search_path` | A SECDEF function without a pinned `search_path` resolves unqualified names against an attacker-controllable schema (hijack). | RLS-bypassing execution context |
| anon / authenticated PostgREST RPC → `create_org_with_default_dept()` | A SECDEF writer is auto-exposed by Supabase as a PostgREST RPC; default `PUBLIC` EXECUTE would make an RLS-bypassing org-creation write callable by logged-out callers (CR-01 surface). | org + dept INSERTs (RLS-bypassing writes) |
| authored migration → live local DB | The unapplied SQL crosses into the running Postgres via the SQL editor; a `db push` / `db reset` apply path would destroy dev data. | schema DDL + seed rows (destructive-apply surface) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-161-01 | Denial of Service / Tampering | `org_members` RLS (`42P17` recursion) | mitigate | Self-rows-only SELECT `USING (user_id = auth.uid())` — direct column compare, NO `org_members` subquery (104:265-266). `org_members` is read only inside the two SECDEF bodies (104:180, 194); every other membership predicate routes through `public.current_user_org_ids()` (104:270,298,310,330,353,373). **Live:** RLS enabled ×8; `SET LOCAL ROLE authenticated` + `SELECT count(*) FROM org_members` ⇒ 0 rows, no SQLSTATE 42P17. | closed |
| T-161-02 | Elevation / Information Disclosure (cross-org) | the 8 new-table read + write policies | mitigate | Reads gate `org_id IN (SELECT public.current_user_org_ids())` (or `id IN (...)` for organizations, 104:298). All 11 INSERT/UPDATE policies carry a `WITH CHECK` pinning `org_id`/`id` to the caller's orgs **and** a role gate via `current_user_has_permission()` (104:279,287,304,315,321,337,344,358,364,378,384). No policy lets org A read/write org B rows. | closed |
| T-161-03 | Elevation of Privilege | `roles` / `role_permissions` + membership write policies | mitigate | (a) `roles`/`role_permissions` = read-all `USING (true)` + ZERO write policy (104:394-400) — migration-only seeding. (b) **CR-02 fix present:** all FOUR membership write-checks (`org_members_insert/update`, `dept_members_insert/update`) carry `AND role <> 'super-admin'` (104:279,287,337,344) — an `org:manage` holder cannot mint/self-escalate to the cross-org super-admin tier. **Live:** 0 non-SELECT policies on the two reference tables; all 4 `pg_policies.with_check` carry the guard; seed matrix super-admin=5 / org-admin=3 / dept-admin=1 / member=0. | closed |
| T-161-04 | Information Disclosure | `org_invitations` | mitigate | Table stores `token_hash text NOT NULL` (104:141); NO plaintext `token` column exists anywhere in the file. | closed |
| T-161-05 | Tampering (search-path hijack + SECDEF exposure) | the 3 SECURITY DEFINER helpers | mitigate | (a) all 3 helpers are `SECURITY DEFINER` + `SET search_path TO 'public'`, internal refs schema-qualified (104:177-178, 189-190, 212-213). (b) **CR-01 fix present:** the sole RLS-bypassing writer `create_org_with_default_dept` has `REVOKE EXECUTE … FROM PUBLIC/anon/authenticated` + `GRANT … TO service_role` (104:233-236). **Live:** `prosecdef=True` + `proconfig=['search_path=public']` ×3; `has_function_privilege` = anon:F / authenticated:F / service_role:T. | closed |
| T-161-06 | zero-behavior-change safety | 23 swept tables + Deep / agent-loop / retrieval path | accept | Additive-only: 23 `ADD COLUMN IF NOT EXISTS org_id uuid` are NULLABLE with NO `REFERENCES` and NO `NOT NULL` in the sweep block (104:448-538 — grep confirms zero of each); new org tables ship empty. Deep Mode byte-identical (ADR SC#4 — no tier made harder). See Accepted Risks Log. | closed (accepted) |
| T-161-07 | Tampering / Availability (destructive apply) | migration application path | mitigate | Migration header mandates SQL-editor paste and forbids `db push` / `db reset` (104:20-29); Plan 02 Task 1 is a BLOCKING operator gate on the same discipline; regeneration uses the no-`--reset` live dump. **Confirmed:** 161-02-SUMMARY records operator-applied-clean + no-reset regen (commit `0a9f6ea3`). | closed |
| T-161-SC | Tampering (supply chain) | package installs | accept | Pure SQL migration — no npm/pip/cargo installs, no new dependency surface. See Accepted Risks Log. | closed (accepted) |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Resolved review criticals (verified present in this audit)

The 161 code review (`161-REVIEW.md`, commit `07bf6a4e`) found two Criticals that empty-table
verification missed. Both fixes are confirmed present in source AND live — they are the CR-01 /
CR-02 legs of T-161-05 / T-161-03 above, not new threats:

- **CR-01** — `create_org_with_default_dept` RLS-bypassing RPC locked to `service_role` (104:233-236). Live `has_function_privilege`: anon=F, authenticated=F, service_role=T.
- **CR-02** — `role <> 'super-admin'` floor added to all 4 membership write-checks (104:279,287,337,344). Without it the plan's own T-161-03 guarantee ("an org-admin cannot grant themselves super-admin") was **false**; the reference-table lock alone did not secure the invariant.

### Tracked latent items (review-deferred — NOT in this phase's declared register)

Surfaced by the code review after plan time; documented here for continuity so they do not get
lost. None is a blocker for Phase 161 (the affected columns are inert for authorization in this
migration — no policy or function reads them yet), and each has a concrete target phase:

| Ref | Concern | Why not a 161 blocker | Owed to |
|-----|---------|-----------------------|---------|
| WR-01 | `dept_members.org_id` denormalized, not FK-constrained to `dept_id`'s true org — an org:manage holder in org A can insert a row whose `dept_id` points into org B. | Row is written into the caller's OWN org namespace (`org_id=A`, RLS-visible only to org A); it does not write or expose org B rows. `dept_members` is not read by any policy/function this phase. Becomes an authz gap only when 163 wires dept-scoped access on the trusted `org_id`. | 163 (composite FK `departments(id,org_id)`) |
| IN-01 | `departments.parent_id` can point cross-org (self-FK, org not pinned). | Departments RLS gates on the row's own `org_id`, not `parent_id`; tree-integrity oddity, not an authz hole. Matches the copied `folders.parent_id` precedent. | 163 |
| IN-02 | `org_invitations.token_hash` has no UNIQUE index (redemption lookup key). | Redemption is Phase 167; no lookup path exists yet. | 167 |
| IN-03 | `org_invitations.invited_by` has no FK to `auth.users`. | Invitation lifecycle is Phase 167; column unused this phase. | 167 |
| INVITE-CEILING | `org_invitations` INSERT has no `role <> 'super-admin'` floor (the org_members/dept_members floor landed via CR-02; invitations are the "same door" for minting a super-admin grant). | Invitation issuance/redemption is not wired until 167; no `org_members` row is created from an invitation this phase. Invited-role validation belongs with the 167 JIT/redemption design. | 167 |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-161-01 | T-161-06 | Zero-behavior-change by construction. The 23 swept `org_id` columns are NULLABLE with no FK and no NOT NULL (verified: zero `REFERENCES` / `NOT NULL` in the sweep block 104:448-538); the 8 new org tables ship empty. No existing query path changes; Deep Mode / agent loop / retrieval stay byte-identical. The FK + NOT NULL hardening is the Phase 162/163 crux. Honors ADR SC#4 (no deployment tier made harder). | Phase 161 plan (161-01-PLAN.md threat_model) | 2026-07-18 |
| AR-161-02 | T-161-SC | No supply-chain surface. Phase 161 is a pure SQL migration — no npm/pip/cargo installs, no new bundled dependency, no lockfile change. | Phase 161 plan (161-01-PLAN.md threat_model) | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 8 | 8 | 0 | gsd-security-auditor (Claude) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18
