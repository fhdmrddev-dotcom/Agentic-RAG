# Phase 161: Org / Dept / Role Schema - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **org/dept/role/membership schema foundation** (ORG-01, ORG-02) — the membership-keyed authorization substrate that later replaces today's binary private-vs-`is_global` visibility. **Additive and zero-behavior-change on creation:** the new tables are empty and the existing tables only gain a nullable column, so Deep Mode / the agent loop / retrieval / every current query stay byte-identical. This is the foundation the backfill (162) and the atomic RLS + user-JWT crux (163) reference.

**Requirements:** ORG-01, ORG-02.

**In scope:**
- **8 new org tables** — `organizations` (incl. `subscription_tier` + `add_ons jsonb` + a new `settings jsonb`), `departments` (nullable `parent_id` self-FK + a one-default-per-org guarantee), `org_members`, `dept_members`, `roles` + `role_permissions` (fixed 4-tier: super-admin / org-admin / dept-admin / member), `org_invitations`, `sso_configs` — all with RLS, FKs, and indexes **from creation**.
- **`current_user_org_ids()` `SECURITY DEFINER` helper** + a **non-recursive self-rows-only `org_members` policy** (breaks `42P17`); every other table's membership predicate calls the helper (never inlines an `org_members` subquery).
- **Nullable `org_id`** added additively to every user-facing table still lacking it (the ~26 tables beyond the 12 already stubbed).
- A seeded, extensible **core permission catalog + default per-tier grants**.

**Out of scope (explicitly):**
- **The membership RLS rewrite of the 38 EXISTING tables + the user-JWT client swap** → Phase 163 (the atomic crux). This phase authors RLS only on the **8 NEW** tables.
- **`document_chunks` / `skill_embeddings` `org_id` denormalize + composite index** → Phase 163 (TEN-04, the perf-gated concern).
- **The personal-org backfill + `is_global`→`is_org_shared` rename** → Phase 162 / 165.
- **Building** per-org provider config / BYO keys / per-org model selection → v3.5 (SEED-120). This phase only *reserves the schema home*.
- Custom/arbitrary role tiers (fixed 4 tiers — REQUIREMENTS Out-of-Scope); cross-org sharing.

</domain>

<decisions>
## Implementation Decisions

### Forward-Compat Org-Settings Substrate (SEED-120 / ADR SC#4)
- **D-01:** Add **`organizations.settings jsonb NOT NULL DEFAULT '{}'`** at creation — the SEED-120 forward-compat home. Nothing reads it in v3.4; the 162 backfill sets `'{}'` on every org for free; v3.5 per-org provider config / BYO keys / per-org (incl. local) model selection land as keys *inside* it. BYO-key values will reuse the **SEC-01 `enc:v1:` MultiFernet envelope + the DB>env `_val` precedence chain** (no new crypto). Kept **separate** from `add_ons jsonb` (which is entitlements/feature-flags per ENT-01) — one home per concern. This is the minimal way to satisfy the ADR's binding "v3.5 adds SEED-120 with **no schema rewrite**" bar (adding-the-column-in-v3.5 would also need a backfill-every-org step; adding it now means the 162 backfill covers it).

### Permission Model Depth
- **D-02:** **Seed a small, extensible CORE permission catalog + default per-tier grants NOW** (not an empty scaffold). The 4 tiers are *fixed*, so the core grant matrix is knowable, not a guess. Seed the milestone-known permission keys — `org:manage` (166), `org:audit_view` (164/166), `dept:manage` (169/166), `org:invite` (167), `sso:manage` (168) — with defaults: super-admin → all; org-admin → `org:*`; dept-admin → `dept:*`; member → baseline (none of the manage perms). So 164/166 have a real permission to check the day they land.
- **D-03:** **Permission keys are OPEN STRINGS** (not a DB enum) so downstream phases (167/169/…) `INSERT` new keys **additively, no schema change**. `role_permissions` is a `(role, permission_key)` grant table; `roles` holds the 4 fixed tiers. The membership's tier lives on **`org_members.role`** (and `dept_members.role` for dept scope) as the fixed 4-tier enum.
- **D-04:** `roles` + `role_permissions` (the default-grant catalog) are **GLOBAL reference data** (same 4 tiers + core grants for every org) — read-all-authenticated, **write-locked (migration-only seeding)**, not org-scoped. Org-admins later extend permission **grants**, never role **tiers**.

### Invitations + SSO Table Depth
- **D-05:** Both `org_invitations` and `sso_configs` ship structurally with **RLS + FK to `organizations` + `org_id` + indexes from creation** (satisfies SC#1). Column depth differs by how certain each table's shape is.
- **D-06:** **`org_invitations` ships NEAR-COMPLETE** (stable, well-understood shape): `org_id`, `email`, `role` (4-tier enum), `token_hash`, `status` (adoption states: pending / accepted / expired / revoked), `expires_at`, `invited_by`, timestamps. Phase 167 adds only app-layer provider wiring (resend/SES/none) + any dept-scoping column then — no churny rewrite.
- **D-07:** **`sso_configs` ships DELIBERATELY THIN**: `org_id`, `email_domain`, a nullable pointer to the Supabase SSO provider id, `attribute_mapping jsonb`, timestamps. Rationale: **Supabase Auth IS the SAML SP** (research STACK headline) — the SAML internals (certs, IdP metadata, XML) live in Supabase's own `auth.sso_providers` / `auth.saml_providers`, NOT our app. Our table is a thin org↔provider↔domain mapping; **phase 168 reveals its real shape live** — don't guess SAML columns now.

### RLS on the 8 New Tables
- **D-08:** **Author membership-correct RLS on all 8 new tables in THIS phase** (not interim placeholders swept by 163). These are net-new tables with **no legacy behavior to preserve** → correct-from-birth is strictly cleaner than the 38 existing tables (where 163 must preserve byte-identical behavior). Empty tables + `current_user_org_ids()` returning empty until the 162 backfill = **safe deny-all interim**; nothing queries org tables via a user-JWT client until after 163. Shrinks the 163 crux's blast radius (its highest-stakes phase). 164's two-org isolation suite (TEN-05) proves all tables regardless.
- **D-09:** The 8 new tables are **EXCLUDED from Phase 163's "38 user-facing tables" RLS-rewrite scope** — 163 rewrites the 38 EXISTING content/identity tables; the 8 org tables are already correct.
- **D-10:** RLS shapes are **table-specific**: org-scoped tables (`organizations`, `departments`, `dept_members`, `org_invitations`, `sso_configs`) are membership-gated via `current_user_org_ids()` (read: member of the org; write: role-gated per the permission catalog); `roles`/`role_permissions` are read-all-authenticated reference data; **`org_members` gets the LOCKED non-recursive self-rows-only policy** (SC#2 / ORG-02) plus an org-admin-can-read-org-members path. The helper breaks the `42P17` recursion; no other table inlines an `org_members` subquery.

### Default-Department Guarantee
- **D-11:** Guarantee **exactly one default department per org BY CONSTRUCTION**: a `departments.is_default boolean` flag + a **partial unique index** (one `is_default = true` per `org_id`), created via a `SECURITY DEFINER` helper (e.g. `create_org_with_default_dept()`) that the 162 backfill AND future org-creation (166/167) both call — a construction guarantee, not a "remember to do it in every caller" convention. **This phase ships only the SCHEMA support** (the flag, the constraint, the helper); the broader trigger-vs-app-layer *creation-seam* decision the research flags stays open at the 162/167 boundary (see Deferred).

### ADR 4-Tier Deployment-Flexibility Contract — per-phase enforcement (binding on 161)
- The ADR's per-phase enforcement clause (D-v3.4-01 SC#4) binds this phase. The org schema is **tier-agnostic** — co-tenant and isolated deployments use the SAME tables (isolated just has one org). Nothing in 161 hardcodes URLs/keys/models/ports; the local setup is unaffected (empty new tables + nullable columns); `organizations.settings jsonb` (D-01) is the forward-compat substrate keeping SEED-120 a no-schema-rewrite v3.5 add. **Verification must confirm no deployment tier is made harder.**

### Claude's / Executor's Discretion
- **Migration idempotency:** `IF NOT EXISTS` / `CREATE OR REPLACE` guards so a re-paste (SQL-editor-paste + re-run-as-recovery workflow) is safe.
- **`org_id` indexing on the ~26 newly-stubbed tables:** plain btree index on `org_id` at creation (cheap on all-NULL columns; ready for the 162 backfill + 163 RLS). *(The `document_chunks`/`skill_embeddings` denormalize+composite-index is a Phase 163 concern — NOT here.)*
- **Exact column types, constraint/index names, and the precise permission-key vocabulary** — executor discretion, as long as SC#1–4 (ORG-01/ORG-02) and D-01…D-11 are honored.
- **Migration lands at slot 104+** (next free); apply via the Supabase SQL editor, then regenerate `full-schema.sql` (never hand-edit; never `db push`/`db reset`). Deployment-artifact same-commit parity per CLAUDE.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The binding ADR + decisions
- `.planning/phases/160-tenancy-model-adr/160-ADR.md` — **D-v3.4-01**, the binding Tenancy-Model ADR: the `is_system_global` / `is_org_shared` naming locks, slot-104+ renumbering, and the **4-tier deployment-flexibility contract** (its per-phase enforcement clause binds 161).
- `.planning/prd-reset/DECISIONS.md` — **D-PRD-02** (hybrid SaaS posture), **D-14** (red line: Deep byte-identical, provider differences at the gateway/adapter boundary, no new runtime), and the **D-v3.4-01** pointer.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — **ORG-01, ORG-02** (this phase's requirements) + the **Out-of-Scope table** (fixed 4 tiers / no custom tiers / no cross-org sharing).
- `.planning/ROADMAP.md` — **Phase 161 detail** (SC#1–4 verbatim) + the **"Guardrails, gates & sequencing (v3.4)"** block (atomic-crux lock, data-dependency order, threat-model list, red line).

### Research base (re-authored against live schema head 103 — highest-signal for this phase)
- `.planning/research/SUMMARY.md` — the two-front-war framing; **Phase-1 (schema) role**; **Pitfall 4** (`42P17` recursion → SECDEF helper); the 8-table enumeration; the **default-dept "one schema, both sizes"** design; 38 user-facing tables (12 already stubbed).
- `.planning/research/ARCHITECTURE.md` — table/function/policy counts; the **12-already-stubbed vs ~26-remaining** breakdown; the `current_user_org_ids()` helper + non-recursive `org_members` policy pattern.
- `.planning/research/PITFALLS.md` — Pitfall 4 (recursive RLS on `org_members`); Pitfall 6 (backfill / `is_global` data loss — a 162 concern, context here).

### Live schema (RE-VERIFY at plan time — research greps head 103; confirm nothing landed since)
- `supabase/full-schema.sql` — the **12 existing `org_id` stubs** (nullable `uuid`, no FK, no index, forward-compat comment) + the existing **`folder_is_globally_visible` `SECURITY DEFINER`** precedent (the recursion-safe pattern this codebase already trusts).
- `supabase/migrations/096_org_id_stub_sweep.sql` — the 4-owned-roots (documents/folders/threads/skills) `org_id` stub shape — the precedent for the ~26 remaining columns.

### Forward-compat obligation (SC#4)
- `.planning/seeds/SEED-120-*.md` — per-org provider config + BYO API keys + per-org (incl. local) model selection; the `organizations.settings jsonb` home (D-01) keeps this a **no-schema-rewrite** v3.5 add. Related: `[[SEED-121]]` (key pooling/rotation), `[[SEED-122]]` (local-model validation), `[[SEED-117]]` (v3.5 config-consolidation).

### Project conventions
- `CLAUDE.md` — the numbered-migration rules (`<digits>_name.sql`; apply via SQL editor, **NOT** `db push`/`db reset`; regenerate `full-schema.sql` after; deployment-artifact same-commit parity); the RLS-on-every-table rule; multi-worker (`WORKER_COUNT=2`) singleton considerations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`folder_is_globally_visible()`** (`supabase/full-schema.sql`) — the existing `SECURITY DEFINER` precedent; `current_user_org_ids()` follows the same recursion-breaking pattern this codebase already trusts.
- **The 12 existing `org_id` stubs** (mig 096 + the v3.0/v2.8 era) — nullable `org_id uuid` with a forward-compat comment; the ~26 new columns mirror this shape (adding a btree index + eventual FK in later phases).
- **`app_settings` + the SEC-01 `enc:v1:` MultiFernet envelope + DB>env `_val` precedence chain** (`backend/app/security/secret_cipher.py`, `save_app_settings` / `_build_settings_from_row`) — the pattern `organizations.settings jsonb` (D-01) forward-compat reuses for BYO keys (**no new crypto**).
- **`operator_users`** (v3.3, org-agnostic system principal) — the one-way-door foundation; the org tables are its user-facing counterpart.

### Established Patterns
- **Two-layer governance** (SEED-116 / VIS-01 / VIS-02): operator allowed-set + lock → org-admin narrows → user picks within → gated visibility. The permission catalog (D-02) + `organizations.settings` (D-01) are this pattern's org layer.
- **RLS-on-every-table** (CLAUDE.md) — every new table gets RLS in the SAME migration; the helper + the non-recursive `org_members` policy ship **WITH** the tables (never a follow-up — avoids Pitfall 4).
- **Additive numbered migrations** at the repo root (`supabase/migrations/104_*.sql`), applied via SQL editor, `full-schema.sql` regenerated after.

### Integration Points
- **None active this phase** (additive schema; new tables empty, existing tables gain a nullable column) — Deep Mode / agent loop / retrieval byte-identical. The integration points this phase **decides in advance**: 162 backfill references the schema + the default-dept helper; 163 RLS rewrite references `current_user_org_ids()`; 166/167 org-admin UI + greenlists reference the permission catalog; 168 SSO extends `sso_configs`.

</code_context>

<specifics>
## Specific Ideas

- The default-dept design must literally serve a **5-person team AND a 2,000-person org with the SAME schema** (SC#4): small orgs never touch `dept_members`; large orgs nest via `departments.parent_id` — zero schema change either way.
- `organizations` MUST carry **`subscription_tier` + `add_ons jsonb` from day one** (SC#1) — the ENT-01 (STRETCH 170) entitlement foothold; `add_ons` is entitlements, **distinct** from the new `settings jsonb` (D-01, provider/key config).
- The permission catalog uses **OPEN-STRING keys**, seeded with the milestone-known set, extensible additively (D-03) — a future planner checks compliance by seeing new keys `INSERT` without a schema change.
- `sso_configs` stays **thin on purpose** — Supabase owns the SAML XML/certs; our table is a mapping, not a SAML store.

</specifics>

<deferred>
## Deferred Ideas

- **Default-department CREATION-SEAM (trigger vs app-layer vs both)** — 161 ships only the schema support (the `is_default` flag + partial-unique constraint + SECDEF helper, D-11); the research-flagged trigger-vs-app-layer creation-seam decision belongs to **Phase 162** (personal-org backfill) / **Phase 167** (JIT provisioning).
- **`document_chunks` / `skill_embeddings` `org_id` denormalize + composite index** — **Phase 163** (TEN-04), the perf-gated crux.
- **Per-org provider config / BYO keys / per-org (incl. local) model selection (SEED-120)** — **v3.5**; 161 only reserves the `organizations.settings jsonb` home (D-01).
- **The membership RLS rewrite of the 38 EXISTING tables + the user-JWT client swap** — **Phase 163** (the atomic crux). 161 authors RLS only on the 8 NEW tables (D-08/D-09).
- **`is_global` → `is_org_shared` rename + the `is_system_global` allow-list** — **Phase 165** (MIG-02). The naming is locked by the ADR; 161 does not touch `is_global`.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (todo.match-phase score 0.2, keyword "schema" false-positive) — **reviewed, NOT folded.** Concerns NL→visual/no-code workflow authoring ([[SEED-123]], the deferred post-v3.4 UX/no-code-builder track) — no relationship to the org/dept/role schema. The same false-positive Phase 160 reviewed-and-deferred; belongs to a later milestone.

### Reported-bugs cross-check (MANDATORY touchpoint — result)
- **No open `surface: Agentic-RAG` reported-bug folds into Phase 161.** All 17 open reports are chat / streaming / frontend / provider / sandbox / model-registry surface (BUG-260609-02/-04, 260610-01, 260623-01, 260706-01, 260708-01/-02, 260712-02, 260714-01, 260718-02/-03/-04, and the cancelled-run / killed-workflow / silent-send cluster) — none overlap this schema phase's `affected_areas`. Per the ROADMAP guardrail + CLAUDE.md filter rule, the chat-surface backlog stays OUT of v3.4 (its own post-v3.3 chat-polish phase); only **SEED-091** folds into v3.4, and it lands in **Phase 164** (TEN-06), not here.

</deferred>

---

*Phase: 161-org-dept-role-schema*
*Context gathered: 2026-07-18*
