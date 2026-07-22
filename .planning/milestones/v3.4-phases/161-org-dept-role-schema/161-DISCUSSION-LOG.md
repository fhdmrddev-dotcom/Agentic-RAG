# Phase 161: Org / Dept / Role Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 161-org-dept-role-schema
**Areas discussed:** Forward-compat org settings, Permission model depth, Invitations + SSO depth, RLS on new tables

---

## Forward-compat org settings (SEED-120 / ADR SC#4)

| Option | Description | Selected |
|--------|-------------|----------|
| `settings jsonb` now | `organizations.settings jsonb NOT NULL DEFAULT '{}'` — empty forward-compat home; 162 backfill sets it free; BYO keys reuse SEC-01 `enc:v1:`; separate from `add_ons jsonb` | ✓ |
| Separate `org_settings` table | Mirror app_settings column-per-setting; premature — guesses columns before SEED-120 designed | |
| Defer entirely | Rely on `add_ons jsonb` + a v3.5 additive migration | |

**User's choice:** `settings jsonb` now (Recommended)
**Notes:** Ties to the ADR's binding "no schema rewrite in v3.5" bar. ~zero cost, keeps provider/key config separate from entitlements (one home per concern), and the 162 backfill sets it on every org for free vs. a v3.5 add-column-and-backfill.

---

## Permission model depth

| Option | Description | Selected |
|--------|-------------|----------|
| Seed core catalog + grants | Milestone-known keys (`org:manage`, `org:audit_view`, `dept:manage`, `org:invite`, `sso:manage`) + default per-tier grants; OPEN-STRING keys so 167/169 extend additively | ✓ |
| Empty scaffold | Tables only; each consuming phase (166/167/169) seeds its own permissions; 161's authz sits inert | |

**User's choice:** Seed core catalog + grants (Recommended)
**Notes:** The 4 tiers are fixed, so the core grant matrix isn't a guess. 164/166 get a real permission to check the day they land. Open-string keys honor the additive-no-rewrite posture. `roles`/`role_permissions` are global reference data (read-all-authenticated, migration-only writes).

---

## Invitations + SSO table depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal-but-real foundations | Both ship RLS+FK+indexes; `org_invitations` near-complete (stable shape); `sso_configs` deliberately thin (Supabase owns SAML → 168 reveals shape) | ✓ |
| Full shape now | Specify every column for both up front; risks guessing `sso_configs` wrong before 168's live Supabase-native SAML wiring | |

**User's choice:** Minimal-but-real foundations (Recommended)
**Notes:** Split verdict — `org_invitations` shape is well-understood so it ships near-complete (low churn); `sso_configs` is genuinely uncertain because Supabase Auth IS the SAML SP (SAML internals live in Supabase's own tables), so a thin org↔provider↔domain mapping now, fleshed out live in 168.

---

## RLS on the 8 new tables

| Option | Description | Selected |
|--------|-------------|----------|
| Author correct in 161 | Membership-correct RLS now via `current_user_org_ids()`; empty→safe deny-all until 162; shrinks the 163 crux; 164 suite still proves them | ✓ |
| Interim, swept by 163 | Placeholder owner-scoped RLS; 163 rewrites all predicates in one leak-tested place — but grows the highest-stakes phase and is semantically wrong for org tables | |

**User's choice:** Author correct in 161 (Recommended)
**Notes:** Net-new tables have no legacy behavior to preserve, so correct-from-birth is cleaner than the 38 existing tables. Excluded from 163's rewrite scope. Table-specific RLS shapes (org-scoped vs read-all reference vs the locked non-recursive `org_members` policy).

---

## Claude's Discretion

- **Default-department guarantee mechanism** (offered as an optional discussion area; user chose "I'm ready for context") — resolved to the recommended default: `departments.is_default` flag + a partial unique index (one-per-org) + a `SECURITY DEFINER` helper both 162 and future org-creation call. The trigger-vs-app-layer *creation seam* stays open at the 162/167 boundary (research-flagged).
- **`org_id` indexing on the ~26 newly-stubbed tables** → plain btree index at creation. `document_chunks`/`skill_embeddings` denormalize+composite-index stays a Phase 163 concern.
- **Migration idempotency** → `IF NOT EXISTS` / `CREATE OR REPLACE` guards for safe re-paste.
- **Exact column types, constraint/index names, precise permission-key vocabulary** → executor discretion, provided SC#1–4 + D-01…D-11 hold.

## Deferred Ideas

- Default-department creation-seam (trigger vs app-layer vs both) → Phase 162 / 167.
- `document_chunks` / `skill_embeddings` `org_id` denormalize + composite index → Phase 163 (TEN-04).
- Per-org provider config / BYO keys / per-org model selection (SEED-120) → v3.5.
- The 38-existing-table membership RLS rewrite + user-JWT client swap → Phase 163 (atomic crux).
- `is_global` → `is_org_shared` rename + `is_system_global` allow-list → Phase 165 (MIG-02).
- Reviewed-not-folded todo: `spike-nl-workflow-authoring.md` (score 0.2, keyword false-positive; SEED-123 no-code track, unrelated).
