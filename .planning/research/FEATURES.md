# Feature Research — v3.4 Multi-Tenancy & Org Access

**Domain:** Org-aware multi-tenant enterprise Agentic-RAG platform (orgs / departments / roles / memberships · membership-based RLS · SSO + onboarding · org-admin & dept-admin shells · role/group feature greenlists · per-user preference layer · commercial footholds · permission-aware RAG)
**Researched:** 2026-07-18
**Confidence:** MEDIUM-HIGH. Competitor claims (Glean/Beam) from their OWN current 2026 docs, fetched 2026-07 (some marketing-glossy → MEDIUM). Supabase SSO + permission-aware-RAG mechanism from official docs fetched 2026-07-18 → HIGH. Multi-tenant RBAC patterns cross-confirmed across WorkOS/Auth0/Clerk → HIGH. Existing-app facts from milestone context + seeds + stale PRD → HIGH.

> **This file supersedes the v3.3 Operator UX FEATURES.md** (2026-07-10) that occupied this slot — the Glean/Beam study it contained (its "Part 1c" that SEED-115 cites) is **carried forward and deepened here** for the org/RBAC lens. Prior content preserved in git history.

---

## PART 0 — SCOPE FRAME (read first)

### What this milestone is

Turn Agentic RAG from a **per-user** app into an **org-aware multi-tenant platform** — the load-bearing one-way-door milestone. Locked posture (**D-PRD-02**): **hybrid SaaS** = co-tenant (`org_id` + membership RLS) by default, isolation-via-deployment for enterprise. Glean is the primary reference competitor (**D-PRD-05**); pricing is 3-tier per-named-user + add-ons (**D-PRD-10**).

### What is ALREADY built — do NOT re-propose (dependency substrate)

| Existing capability | Shipped | How v3.4 builds on it |
|---|---|---|
| Binary visibility: private (`user_id`) vs `is_global` folders/skills | v1.0 | **Replaced** by membership-keyed org/dept/role visibility |
| `org_id` **stub columns** on documents / folders / threads / skills | mig 096 (v3.3) | The RLS rewrite fills + enforces them; the one-way door is pre-poured |
| `operator_users` — org-**agnostic** platform-operator principal (deny-all RLS) + gated `/admin` Control Room + append-only operator audit ledger | Phase 146 (v3.3) | Operator sits **above** all orgs; org-admin / dept-admin are **new tiers WITHIN an org**. The profile menu is the user-side counterpart to the operator shield |
| **VIS-01** feature-visibility map: binary "Everyone \| Operators-only" audience, shaped as an **extensible enum**, `require_visible` resolves through **ONE swappable function** | Phase 148 (v3.3) | **The literal seed of role/group greenlists** — the audience picker grows to accept roles/groups; "is operator" → "is in group X" at one boundary |
| Solo / Team / Enterprise **deploy presets** + `OPERATOR.md` + install wizard | Phases 157/158 (v3.3) | The **isolation-via-deployment** half of the hybrid posture |
| **CITE-01** — per-claim inline citations keyed to the **real retrieval set** | Phase 153 (v3.3) | The surface permission-aware RAG must not leak through |
| App-wide **plain-language layer** behind an advanced reveal (LANG-01) | Phase 154 (v3.3) | Org-admin / dept-admin shells inherit the two-audience contract |
| Supabase Auth (JWT) + per-user owner-keyed RLS everywhere | base | SSO extends Auth; RLS predicate is re-keyed membership-based |
| `user_settings` / `app_settings` + Settings UI; operator allowed-set→lock pattern (SEED-116 resolved) | v3.3 | The per-user preference layer + org-settings tier land here |

### KNOWN ANTI-FEATURES — decided up front (details in Part 4)

These are **explicitly NOT built in v3.4**. Surfacing them here so requirements never re-litigate:

1. **Cross-org sharing** — ANTI-FEATURE (permanent). Orgs are isolated by default; any cross-org share re-opens the exact leak class the RLS rewrite closes. The **only** legitimate cross-org visibility is the seeded system-skill allow-list (`skill-creator`).
2. **Custom / arbitrary role tiers** — DEFER. v3.4 ships **4 fixed tiers** (super-admin / org-admin / dept-admin / member); org-admins may extend permission *grants* but not mint new role *tiers*.
3. **SCIM provisioning** — DEFER. SAML JIT covers v1 enterprise onboarding; SCIM lands when a customer needs directory-driven **de**-provisioning/offboarding.
4. **Per-resource ACLs beyond folder-level** — DEFER. The doc-permission unit is the **folder** (our KB container). Per-document / per-field ACLs are vertical-pack / Tier-B territory.
5. **SSO enforcement** (no email/password fallback for org members) — DEFER to a follow-on. v3.4 ships SSO **+ fallback**.
6. **Billing / payment surface** (Stripe, invoicing, dunning, proration) — DEFER. v3.4 ships the entitlement *columns + reusable check foothold*; the checkout surface consumes it later.
7. **Impersonation ("sign in as user")** — DEFER (SEED-115). Role-scoped, heavy-audit; ships with a later roles pass.
8. **Retention / rate-limit ENFORCEMENT** — DEFER (v3.5 config pass / v3.6 Automations). v3.4 ships the **data-layer footholds + admin surfaces only**.

---

## PART 1 — THE REFERENCE MODELS (Glean primary · Beam thinner · classic DMS)

> Operator directive (SEED-115): study how best-in-class DMS + Glean/Beam manage org access, and make v3.3's forward-compat shapes fit. All claims below are from the competitors' own current docs unless marked.

### 1.1 Glean — the closest analog, three-tier access model (Confidence HIGH — docs.glean.com, fetched 2026-07)

Glean layers org access in exactly the three tiers this milestone must build:

**Tier 1 — Identity & groups inherited from the IdP directory.** Users + departments/groups are **synced from the IdP (SSO/SCIM), never hand-maintained in-app**. "Glean automatically syncs group membership changes from your IdP" — SAML/SCIM in near-real-time, OIDC "up to three hours of sync delay." Adoption states surface on the People page: **not-yet-invited / pending / active**.

**Tier 2 — Admin role tiers + group-based feature greenlists.** Three admin tiers with increasing scope (verbatim from the roles doc):
- **Setup Admin** — most restrictive: connect/manage connectors, manage SSO/auth settings, initiate crawls, indexing tokens only.
- **Admin** — intermediate: user role management (excluding Super Admin assignment), UI customization, API tokens (excluding global scope).
- **Super Admin** — full access, incl. assigning Admin-Search + DLP-moderator roles and global-scope tokens. **Requires written CISO authorization; disabled by default.**
- Plus a specialized **Sensitive Content Moderator** (manage document visibility in search, access sensitive/admin search) — a *content-scoped* grant orthogonal to the admin tier.

Admin roles **can be assigned to IdP groups** ("an Azure AD group of IT admins"), so users **inherit** admin permissions from group membership. **Feature access is gated per group via "greenlist-style provisioning"**: "you can now select **groups as principals** in addition to individual users" for **Glean access**, **feature rollouts**, and **connector test groups**. Multi-group precedence merge: primary role = highest-precedence wins (**Super Admin → Admin → Setup Admin → Member**); secondary roles = **union** of all direct + group assignments.

**Tier 3 — Permission-aware document access.** Per-request permission checks — retrieval "**returns only what the user can access**"; **source-ACL mirroring per connector** (Glean re-derives each connected system's ACLs); **search governance** — admins can **check whether a user can access a doc** and **hide documents** from results. Agent governance adds per-request permission checks on agent actions + alignment scoring.

**→ Our mapping:** Glean's three tiers map 1:1 onto v3.4's three problems — (1) org/dept/group model + SSO import, (2) admin tiers + role/group greenlists (the VIS-01 generalization), (3) permission-aware RAG (Part 3). We do NOT have 100+ connectors, so "source-ACL mirroring" collapses to **folder-level ACL** (our single container type) — dramatically simpler than Glean's per-connector mirror.

### 1.2 Beam AI — thinner, workspace/team + HITL governance (Confidence MEDIUM — marketing + reviews)

Beam is **agentic process automation**, not KB-RAG. Access control is **workspace/team-based** with **human-in-the-loop governance**: RBAC, OAuth-scoped tool access, immutable audit trails per agent action, cost attribution by workflow, agent versioning + rollback + autonomy throttle. It **confirms the direction** (RBAC + workspaces + audit) but adds little org-schema detail. Takeaway: Beam validates that **audit + RBAC + workspace-scope** is table-stakes; it does NOT model departments/nested-groups the way Glean (or we) must.

### 1.3 Classic DMS (SharePoint / Box / Egnyte) — the folder-inheritance precedent (Confidence MEDIUM — general knowledge)

The DMS canon is **RBAC + groups + folder-permission inheritance**: permissions attach to a folder and **inherit down the subtree**, with optional break-inheritance per subfolder. This is the precedent for our model — we already have **nested folders + folder-subtree scope resolution** (v1.0 Phase 8, reused by Phase 098). v3.4's job is to make folder permission **membership/dept/role-scoped** instead of binary private/global, inheriting down the subtree we already resolve.

### 1.4 Multi-tenant RBAC canon (Confidence HIGH — WorkOS / Auth0 / Clerk / SuperTokens agree)

- **Org = tenant.** Roles are **scoped per-org**, never global: check "is user admin *in this org*," not "is user admin." A user can be in **multiple orgs with different roles**.
- **Schema strategy at our scale:** "each table has a **tenant column** for isolation that scales to tens of thousands of tenants" (vs schema-per-tenant ~hundreds, db-per-tenant = max isolation). Co-tenant + `org_id` column + **RLS** is the documented right choice for our band (hundreds–thousands of users/org, D-PRD-01).
- **Isolation must be enforced at multiple layers** (token / middleware / policy / **database RLS** / encryption) — belt-and-suspenders, not RLS alone.
- **Fixed role sets are fine for SMB; enterprises eventually want custom roles** ("Billing Admin," "Compliance Auditor"). → validates our "fixed 4 tiers now, custom-roles DEFER" cut, and flags custom roles as the first post-v3.4 RBAC ask.

---

## PART 2 — FEATURE CATALOG (by category · CORE-v1 / STRETCH / ANTI-FEATURE)

Legend — **Tag:** CORE-v1 (in approved v3.4 scope) · STRETCH (add if capacity / research-gated) · ANTI (do not build) · DEFER (later milestone). **Cx:** complexity LOW/MED/HIGH. **Dep:** dependency on existing substrate.

### Category A — Org / Department / Role / Membership model

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| A1 | **`organizations` table** — id, name, slug, `is_personal`, `subscription_tier` (default 'standard'), `add_ons jsonb`, timestamps | CORE-v1 | MED | Fills `org_id` stub cols (mig 096); tier/add-on cols per D-PRD-10 |
| A2 | **`departments` table** — org_id FK, name, **nullable `parent_id` self-FK (nesting)**; **one auto-created default dept per org** | CORE-v1 | MED | Net-new; the "one schema, both sizes" keystone (see below) |
| A3 | **`org_members` join** — (org_id, user_id) PK, `role` tier, `joined_via` (invitation / sso_jit / personal_auto / admin_create) | CORE-v1 | MED | New; keys the whole RLS predicate |
| A4 | **`dept_members` join** — (dept_id, user_id) PK, role; a user may be in many depts | CORE-v1 | MED | New; optional layer (default-dept case never needs it) |
| A5 | **Fixed 4-tier role model** — super-admin / org-admin / dept-admin / member (enum on membership row) | CORE-v1 | LOW | New enum; **NOT** arbitrary custom tiers (A11 is ANTI) |
| A6 | **`role_permissions` seed table** — data-driven permission grants per tier (`org:manage`, `org:audit_view`, `documents:read/write`, `skills:share_dept`, `dept:manage`, …) | CORE-v1 | MED | New; lets org-admins extend *grants* without new *tiers* |
| A7 | **Membership-based RLS predicate rewrite** on every user-facing table (owner-within-org OR org-shared OR dept-shared) | CORE-v1 | **HIGH** | The riskiest change; own phase + isolation test harness. Rewrites ~20+ tables incl. the v2.7–3.0 workflow/workspace/doc-mgmt tables |
| A8 | **Per-request user-JWT Supabase client** + `SECURITY DEFINER → INVOKER` audit (`match_document_chunks`, `folder_is_globally_visible`, `query_user_documents`) | CORE-v1 | **HIGH** | Closes the text-to-SQL + chunk-match bypass classes **and** the SEED-091 global-resource owner-UUID leak (the one bug that folds here); replaces service-role singleton on hot paths |
| A9 | **`is_global` → `is_org_shared` retirement** on folders/skills + `is_system_global` allow-list (only legit cross-org visibility) | CORE-v1 | MED | Data migration + column rename; preserves seeded `skill-creator` |
| A10 | **Org context on every request** — active-org resolution (`X-Org-Id` header or JWT claim) validated against `org_members` | CORE-v1 | MED | New middleware seam; feeds RLS + writes |
| A11 | **Custom/arbitrary role tiers** with user-defined permission graphs | **ANTI (defer)** | HIGH | Enterprises want it eventually (canon 1.4) — first post-v3.4 RBAC ask, not now |
| A12 | **Department-targeted skill/automation availability** (private / dept / org / system-global) | STRETCH | MED | Rides A9 + skill catalog; SEED-004's "genuinely new" piece. Fold if skills RLS is already being rewritten |

**The "one schema serves both small AND large org" design (SEED-004 §28, the v1 decision that avoids a rewrite):**
- Every org gets **exactly one auto-created default department** at creation. A **small org** lives entirely in that default dept — the dept UI can be collapsed/hidden, and `dept_members` is never touched (membership at the org level suffices).
- A **large org** adds departments freely; `parent_id` (nullable self-FK) gives arbitrary **nesting** with zero schema change. Roles are per-membership-row, so the same tables express "5-person team, no structure" and "2,000-person org, 40 nested depts."
- **Recommendation (from SEED-115): roles before departments.** Ship the role enum on the membership row first (the greenlist audience picker grows to accept it); treat departments/groups as **directory-sourced objects** (SSO/SCIM import first, manual CRUD fallback). This keeps the schema honest without over-investing in dept UX before a customer needs nested depts.

### Category B — Onboarding flows

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| B1 | **Personal-org backfill migration** — every existing user → their own `is_personal` org + default dept + org-admin membership; backfill `org_id` on all rows; nothing breaks, no user action | CORE-v1 | **HIGH** | The migration story for the whole milestone. Idempotent, transactional-batched (lock-storm risk on large tables). This is the "nothing breaks" contract |
| B2 | **Email invitations** — org-admin sends `{email, role, dept?}`; hashed token; expiry; accept via sign-in-or-sign-up → `org_members` (joined_via=invitation) | CORE-v1 | MED | New `org_invitations` table + transactional email provider (Resend/SES via env; `none` mode logs link for dev) |
| B3 | **Link-based invitations** — same accept handler, org-admin generates a shareable link without sending email (paste-into-Slack) | CORE-v1 | LOW | Shares B2's accept path |
| B4 | **SSO JIT provisioning** — first SSO login with no `auth.users` row auto-creates the user + `org_members` (joined_via=sso_jit) using the org's default role; attribute-map claim→dept | CORE-v1 | MED | Rides SSO (B7); Supabase "auto-provisioning" toggle is the native hook |
| B5 | **Adoption states on a People surface** — not-yet-invited / pending / active (Glean's model) rendered as a roster column | CORE-v1 | LOW-MED | Extends Phase-148 user roster (already a chip-set role column, extensible by design) |
| B6 | **Roster shows role + department as additive chips** | CORE-v1 | LOW | Phase-148 roster already chip-shaped for exactly this (Running Design Decision 59) |
| B7 | **SSO — SAML 2.0** via Supabase Auth (per-org via email-domain) + JIT | CORE-v1 | MED | **Native Supabase (Pro+ managed OR self-hosted SAML).** See SSO note below |
| B8 | **SSO — OIDC / OpenID Connect** enterprise org SSO | **STRETCH** | HIGH | **NOT native** to Supabase enterprise SSO (SAML-only) — needs a custom SP (Authlib). See SSO note — this REVISES the stale PRD's "SAML + OIDC both via Supabase" claim |
| B9 | **SSO enforcement** (disable email/password for SSO orgs) | DEFER | MED | v3.4 ships SSO **+ fallback**; the enforce flag flips later |
| B10 | **SCIM provisioning / directory-driven offboarding** | **ANTI (defer)** | HIGH | SAML JIT covers onboarding; SCIM lands on first offboarding-driven customer ask |

**SSO note (HIGH confidence, revises stale PRD — official Supabase docs fetched 2026-07-18):** Supabase Auth **enterprise SSO supports SAML 2.0 only** ("Supabase Auth supports enterprise-level SSO for any identity providers compatible with the SAML 2.0 protocol"; "offered on plans Pro and above"). Per-org routing is by **email domain**; an **auto-provisioning toggle** gives JIT-style membership on login. **OIDC is NOT offered as an enterprise/org SSO protocol** (OIDC exists only as a per-app *social* login provider, not the domain-routed org-SSO flow). Self-hosted Supabase has a **separate self-hosted SAML SSO** path (good for the on-prem enterprise half of D-PRD-02). **→ Recommendation: SAML = CORE; OIDC enterprise SSO = STRETCH** behind a custom Authlib SP, or fast-follow — do not promise "SAML + OIDC both native."

### Category C — App-shell surfaces (identity + admin)

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| C1 | **Profile / identity anchor** (SEED-113) — top-right menu: name, email, **role/tier badge**, link to Settings, **sign-out** | CORE-v1 | MED | User-side counterpart to Phase-146 operator shield; G-2 sketch-gated (pairs with nav-crowding BUG-260711-01). Native "who am I" the app lacks today |
| C2 | **Org switcher** — multi-org users switch active org; persists (localStorage + JWT claim); switch clears thread/stream state for the new scope | CORE-v1 | MED | Lives in the profile anchor; wraps OUTSIDE StreamsProvider so streams read active org; must preserve the Branch-D3 clear guard |
| C3 | **Org-admin shell (7 tabs)** — Members & Invitations / Departments & Roles / SSO / Audit (org-scope) / Subscription & Add-ons / Retention / Settings; gated on `org:manage` | CORE-v1 | HIGH | Extends the Phase-146/147 permission-gated shell pattern; a NEW org-scoped surface distinct from the platform `/admin` Control Room |
| C4 | **Dept-admin shell (narrower)** — Dept Members / Dept Skills / Dept Retention / Dept Audit; gated on `dept:manage` | CORE-v1 | MED | Same shell pattern, narrower permission |
| C5 | **Org-scoped audit view** — org-admin sees all members' audit rows in-org (never cross-org); member sees own | CORE-v1 | MED | Adds `org_id` to existing `audit_log` (not a new table, SEED-004 §7) + permission-gated read |
| C6 | **Settings IA split** — personal preferences stay user-scoped (move to profile menu); org controls behind `org:manage`; platform controls stay in Control Room | CORE-v1 | MED | Resolves the SEED-116 three-surface boundary (Control Room / Settings / Profile) |
| C7 | **Impersonation ("sign in as user")** | DEFER | MED | SEED-115 — role-scoped, heavy-audit; ships with a later roles pass |

### Category D — The Glean permission-aware model (see Part 3 for the RAG call)

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| D1 | **Groups/departments importable from the IdP directory** (SSO attribute-map → dept membership) | CORE-v1 (basic) | MED | Rides B4/B7; full SCIM directory-sync is DEFER (B10) |
| D2 | **Admin tiers assignable to groups** (Glean pattern) — a group grants an admin role | STRETCH | MED | Rides A5/A6 + greenlists; nice-to-have vs per-user grants |
| D3 | **Folder-level ACL = the doc-permission unit** (share a folder to dept/role, inherit down subtree) | CORE-v1 | HIGH | Our KB container = folder (Glean's "container" precedent); reuses Phase-098 subtree resolution |
| D4 | **Permission-aware retrieval** — retrieval returns only chunks the asker can access | **CORE-v1 (org-level) / STRETCH (intra-org folder-ACL)** | HIGH | **See Part 3 — the headline recommendation** |
| D5 | **Search governance — "hide documents" / "check user access"** (Glean) — admin verifies/masks doc access; citations never name inaccessible docs | **STRETCH (research-gated)** | HIGH | Touches CITE-01; the citation-surface hardening half of permission-aware RAG |
| D6 | **Per-connector source-ACL mirroring** (Glean's 100+ connectors) | **ANTI (N/A)** | — | We have no connectors; collapses to folder-ACL (D3). Do not build a mirror layer |

### Category E — Feature visibility by role/group (generalize VIS-01)

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| E1 | **Role/group greenlists** — generalize the binary "Everyone \| Operators-only" audience into a **per-feature audience set that lists roles and/or groups** (Glean greenlist-style) | CORE-v1 | MED | **VIS-01 is the exact seed**: audience is already an extensible enum; `require_visible` already resolves through ONE swappable function — "is operator" → "is in group X / has role Y" at that one boundary |
| E2 | **Advanced/admin features role-gated off end-user surfaces** (eval, model curation, cost internals) | CORE-v1 | LOW-MED | SEED-099; first consumers already flagged (Phase-137 eval surface). Rides E1 |
| E3 | **Greenlist precedence merge** — user in multiple groups = union of grants; highest role wins for primary tier (Glean's documented rule) | CORE-v1 | LOW | Pure resolver logic at the one boundary |
| E4 | **Per-group feature-rollout / beta gating** (Glean "feature rollouts" greenlist) | STRETCH | LOW | Same mechanism as E1, different audience — cheap add once E1 exists |

### Category F — Per-user preference layer (allowed-set → preference)

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| F1 | **Revive `user_settings.preferences`** (dead since mig 011) as the per-user preference store | CORE-v1 | LOW | SEED-117 §2; the column exists, just unused |
| F2 | **Two-layer allowed-set → preference pattern** — operator/org defines the ALLOWED SET (+ optional lock); user picks their **default within it** (canonical example: model default within org-enabled models) | CORE-v1 | MED | Already the SEED-116-resolved pattern (operator allowed-set+lock → user preference → gated visibility); F2 makes it real for model + a few knobs |
| F3 | **Org-level default that a user may override** (unless locked) | CORE-v1 | MED | Rides F2 + org settings (C6) |
| F4 | **Per-user free-form terminology / arbitrary setting overrides** | ANTI | — | Drift + support nightmare; one curated glossary, two audiences (LANG-01 already decided this) |

### Category G — Commercial surfaces (footholds now, enforcement later)

| # | Feature | Tag | Cx | Dependency on existing |
|---|---|---|---|---|
| G1 | **`subscription_tier` + `add_ons jsonb` on every org from day 1** | CORE-v1 | LOW | D-PRD-10; ships with A1. Pure schema |
| G2 | **Reusable entitlement check primitive** — `require_tier('pro')` / `require_add_on('governance')` as one FastAPI dependency (replaces the lying `_is_tier_pro_or_higher` stub that returns True) | CORE-v1 (foothold) | MED | **SEED-080** — one home before N ad-hoc gates. Reads tier/add-on via the existing TTL-cache settings pattern; shares the flag substrate |
| G3 | **Per-org retention policy — data layer + admin UI** (retention_policies table; per-dept or org-wide; action-at-expiry) | CORE-v1 (foothold) | MED | SEED-005 Tier-B foothold; **enforcement sweeper DEFER to v3.6 Automations** |
| G4 | **Per-org rate-limit — data layer + admin UI** (org_rate_limits table; per-endpoint RPM) | CORE-v1 (foothold) | LOW-MED | **Enforcement (Redis token-bucket) DEFER to v3.5 Open Platform** |
| G5 | **Honest "this is a Pro/Enterprise feature" refusal surface** (one component, not per-feature copy) | STRETCH | LOW | Rides G2; makes gating upgrade-legible + auditable as one matrix |
| G6 | **Billing / checkout / invoicing / dunning surface** (Stripe) | DEFER | HIGH | Consumes G2; separate monetization milestone |
| G7 | **Named-seat counting + shadow-user enforcement** | DEFER | MED | D-PRD-10 sub-concern; needs the billing surface |
| G8 | **Cost / spend-cap enforcement** | DEFER | HIGH | SEED-117 §3 — needs duration telemetry (SEED-023); maps to tier via G2 but is cost, not entitlement |

---

## PART 3 — PERMISSION-AWARE RAG: CORE vs STRETCH (the headline recommendation)

**The downstream question:** should permission-aware RAG — folder-level ACL so retrieval only **cites** what the asking user may access — be CORE or a research-gated STRETCH?

**Recommendation: SPLIT the concern into three parts with different verdicts.** A flat "CORE" or "STRETCH" is the wrong shape because the pieces have very different cost and risk.

### 3a. Org-level retrieval isolation → **CORE (non-negotiable, already inside the RLS rewrite)**

Cross-**org** chunk isolation is **not optional and not separable** — it *is* the milestone's security thesis. The `match_document_chunks` SECURITY DEFINER→INVOKER audit (A8) is already CORE. Supabase's own guidance is explicit and directly usable: **RLS on the chunks table is applied implicitly to the vector similarity search** — "semantic search over these sections will continue to respect these RLS policies" ([Supabase RAG-with-permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)). So once `document_chunks` carries an org-scoped RLS predicate and the match function runs SECURITY INVOKER, **retrieval returning only the asker's-org chunks falls out for free**. Skipping it would leave a cross-tenant leak — the entire reason v3.4 exists. **Verdict: CORE.**

### 3b. Intra-org folder-ACL retrieval FILTER → **CORE-adjacent (fold in — near-free, and skipping it is a latent leak)**

Here is the key insight the "CORE vs STRETCH" framing usually misses: **because A7 is already re-authoring the RLS predicate on `document_chunks`, authoring it to mirror the FULL folder-visibility model (owner OR org-shared OR dept-shared) gives folder-ACL-aware retrieval as a near-free consequence** — the same implicit-RLS-on-similarity-search mechanism from 3a. The industry consensus is emphatic that this belongs in the retrieval layer, not the app layer: "most enterprise RAG systems enforce access control in the application layer and **most of them leak** confidential documents to the wrong users as a result" ([TianPan](https://tianpan.co/blog/2026-05-04-permission-aware-retrieval-enterprise-rag-access-control)); pre-filter (RLS/WHERE) beats post-filter, which "breaks the contract of request-k-get-k and introduces information leakage" ([Pinecone](https://www.pinecone.io/learn/rag-access-control/)). **If `document_chunks` RLS diverges from `documents`/`folders` RLS, that divergence is itself the bug.** **Verdict: fold the retrieval-filter half into CORE** — it is cheaper to do correctly once (during the rewrite) than to bolt on later, and doing it wrong later means the chunk predicate lies relative to the doc predicate.

### 3c. The permission-aware CITATION surface + perf/recall gate + search-governance → **STRETCH (research-gated — this is the genuinely hard, CITE-01-touching part)**

What genuinely deserves a research gate, and what the operator should treat as slippable STRETCH:

1. **CITE-01 citation-surface hardening.** v3.3 shipped CITE-01: per-claim inline citations keyed to the *real* retrieval set. If retrieval is folder-ACL-filtered, the citation surface must **never reveal even the existence or title** of a doc the asker can't open (Glean's "hide-documents / check-user-access"). A citation chip that names an inaccessible file **is a leak** — and half-right here is *worse than not doing it*. This is precision-critical and deserves its own threat model, not a bolt-on. **STRETCH.**
2. **pgvector performance + recall unknown.** Supabase's guide warns "**RLS is latency-sensitive** — use the query plan analyzer" and gives **no guidance on RLS combined with ivfflat/hnsw**. A richer per-row folder-visibility predicate over the vector index is an **unmeasured** latency/recall interaction (the stale PRD flagged ~20% for org-only; folder-level is heavier, and pre-filtering can degrade ANN recall). Needs a **benchmark gate** before the guarantee is promised. **Research-gated.**
3. **Search-governance admin controls** (Glean's check-access / hide-documents admin tools). Nice, not load-bearing for v1. **STRETCH.**

### Bottom line for requirements

- **Commit as CORE:** org-isolation at retrieval (3a) **and** authoring `document_chunks` RLS to mirror the folder-visibility model so the retrieval FILTER is consistent (3b). These are inseparable from the RLS rewrite and cheaper to do once.
- **Research-gate as STRETCH (may slip without breaking the security guarantee):** the CITE-01 "only *cites* what you can access" hardening (3c#1), the retrieval latency/recall **benchmark gate** (3c#2), and search-governance admin controls (3c#3). Org isolation already prevents cross-tenant leaks regardless, and the intra-org fallback is coarse-but-safe (the same RLS predicate that governs all of the user's access also governs their citations).
- **Sequencing:** 3c depends on **D3 (folder-level dept/role sharing) landing and stabilizing first** — you cannot ACL-filter on a visibility dimension that doesn't exist yet. So even if capacity allows, permission-aware *citations* come **after** the schema + folder-sharing + RLS rewrite are green.
- **Flag for phase research:** the permission-aware-RAG phase needs its own research spike (CITE-01 leak threat model + pgvector-RLS benchmark) and a G-5 hot-file check (`retrieval_service.py`, `threads.py`, `MessageItem.tsx`, the citation renderer).

---

## PART 4 — ANTI-FEATURES (explicit, with alternatives)

| Anti-feature | Why it gets requested | Why it's problematic | Instead |
|---|---|---|---|
| **Cross-org sharing** (share a folder/skill/doc to another org) | "Partner orgs want to collaborate" | Re-opens the exact cross-tenant leak class the RLS rewrite closes; unbounded blast radius | Isolation by default; only the seeded system-skill allow-list (`is_system_global`) crosses orgs. B2B2C bounded-guest access is a later vertical-pack ask |
| **Custom / arbitrary role tiers** | "Enterprises want Billing Admin, Compliance Auditor…" (canon 1.4 confirms) | Huge surface; permission-graph editor + audit; premature before the fixed model proves out | Fixed 4 tiers now; org-admins extend permission *grants* on the seeded roles; custom *tiers* = first post-v3.4 RBAC ask |
| **SCIM provisioning** | "Directory-driven user lifecycle" | Full SCIM server + de-provisioning semantics; large; SAML JIT covers onboarding | SAML JIT now; SCIM when a customer needs offboarding-via-directory |
| **Per-resource ACLs beyond folder-level** (per-doc, per-field) | "Fine-grained control" | Explodes the permission model + retrieval predicate; Tier-B / vertical-pack territory | Folder is the ACL unit (inherits down subtree); per-doc later |
| **Per-connector source-ACL mirroring** (Glean-style) | "Mirror SharePoint/Box ACLs" | We have **no connectors**; a mirror layer with nothing to mirror | Folder-ACL is our single container type |
| **SSO enforcement in v1** (no email/password fallback) | "Enterprises mandate SSO-only" | Lockout risk during rollout; migration hazard | Ship SSO **+ fallback**; add an enforce flag later |
| **Billing / checkout surface** (Stripe, dunning, proration) | "Monetize now" | Separate monetization concern; consumes the entitlement check rather than being it | Ship tier/add-on columns + reusable check foothold (G2); checkout later |
| **Retention / rate-limit ENFORCEMENT** | "Make the policy real" | Needs a scheduler (v3.6) / Redis token-bucket (v3.5) + duration telemetry (SEED-023) | Data-layer + admin UI now (G3/G4); enforcement follows |
| **Impersonation without heavy audit** | "Support wants to see what the user sees" | Privilege-escalation + trust hazard if under-audited | Defer to a roles pass with mandatory audit trail (SEED-115) |
| **Explicit per-user setting free-text overrides / renaming** | "Let users customize everything" | Config drift, support burden | Curated glossary + two-audience reveal (LANG-01 decided) |

---

## PART 5 — FEATURE DEPENDENCIES

```
Org/Dept/Role schema (A1-A6)  ── fills ──> org_id stubs (mig 096, LIVE)
    └──enables──> Membership RLS rewrite (A7)  [the risky keystone]
                      └──requires──> per-request user-JWT client + SECDEF→INVOKER audit (A8)
                      └──requires──> Personal-org backfill (B1)  [must precede NOT NULL org_id]
                      └──produces──> org-level retrieval isolation (D4/3a)  [CORE, near-free]
                      └──produces──> folder-ACL retrieval filter (D4/3b)  [CORE-adjacent, author RLS once]

is_global → is_org_shared (A9)  ──requires──> folder-sharing-to-dept/role (D3)
    └──enables──> permission-aware CITATIONS (D5/3c)  [STRETCH — needs D3 stable first]
                      └──touches──> CITE-01 (LIVE)  [leak-critical citation surface]
                      └──gated-by──> pgvector+RLS latency/recall benchmark  [research spike]

SSO SAML (B7) ──native──> Supabase Auth (Pro+/self-hosted)
    └──enables──> JIT provisioning (B4) ──feeds──> dept import (D1)
    └──OIDC (B8) is NOT native ──needs──> custom Authlib SP  [STRETCH]

VIS-01 map (LIVE, one swappable fn) ──generalizes-to──> role/group greenlists (E1)
    └──first consumer──> hide advanced features from end users (E2, SEED-099)

user_settings.preferences (dead, mig 011) ──revived──> per-user preference (F1)
    └──sits-under──> operator/org allowed-set + lock (F2, SEED-116 pattern)

orgs.subscription_tier + add_ons (G1) ──read-by──> entitlement check (G2, SEED-080)
    └──replaces──> _is_tier_pro_or_higher stub (returns True today)
    └──maps-to──> retention/rate-limit footholds (G3/G4)  [enforcement deferred]

Profile identity anchor (C1, SEED-113) ──hosts──> org switcher (C2), role badge, sign-out
Org-admin shell (C3) ──gated-on──> org:manage ; Dept-admin (C4) ──gated-on──> dept:manage
```

**Critical ordering:** (1) schema (A1-A6) → (2) personal-org backfill (B1) → (3) RLS rewrite + SECDEF audit (A7/A8) as ONE atomic, isolation-tested change → (4) `is_global` retirement + folder-sharing (A9/D3) → (5) SSO + onboarding (B) + shells (C) → (6) greenlists (E) + preference layer (F) + commercial footholds (G) → (7) **research-gated** permission-aware citations (3c). The Phase-0 ADR **ratifies** the co-tenant + isolation-via-deployment posture (pre-decided by v3.3's stubs/presets) — it does not re-litigate.

---

## PART 6 — MVP / SCOPE RECOMMENDATION

### CORE-v1 (approved v3.4 scope)
- [ ] Org / dept / role / membership schema (A1–A6, A9, A10) + department "one-schema-both-sizes" default-dept design
- [ ] Membership-based RLS rewrite + per-request user-JWT client + SECDEF→INVOKER audit (A7, A8) — **own phase + isolation harness**; folds SEED-091
- [ ] Personal-org backfill migration (B1) — the "nothing breaks" contract
- [ ] Email + link invitations (B2, B3) + adoption states/roster (B5, B6)
- [ ] **SAML 2.0 SSO** + JIT provisioning (B7, B4) — native Supabase
- [ ] Profile identity anchor + org switcher (C1, C2, SEED-113) — G-2 sketch-gated
- [ ] Org-admin 7-tab + dept-admin shells + org-scoped audit + Settings IA split (C3–C6)
- [ ] Role/group feature greenlists generalizing VIS-01 (E1–E3) + advanced-feature gating (E2)
- [ ] Per-user preference layer + allowed-set→preference two-layer (F1–F3)
- [ ] Commercial footholds: tier/add-on columns + reusable entitlement check + retention/rate-limit data-layer + admin UI (G1–G4)
- [ ] Folder-level ACL sharing to dept/role (D3) + org-level & folder-ACL retrieval FILTER (3a/3b — fold into the RLS rewrite)

### STRETCH (add if capacity / research-gated)
- [ ] **Permission-aware CITATIONS** — "only *cites* what you can access" (D5/3c) — CITE-01 leak-threat-model + pgvector-RLS benchmark gate FIRST
- [ ] OIDC enterprise SSO via custom Authlib SP (B8)
- [ ] Department-targeted skill/automation availability (A12) — fold if skills RLS already rewritten
- [ ] Admin tiers assignable to groups (D2), per-group beta rollouts (E4)
- [ ] Honest Pro/Enterprise refusal surface (G5)

### DEFER → v3.5+ / later
- [ ] SSO enforcement (B9), SCIM (B10), impersonation (C7)
- [ ] Custom role tiers (A11), per-resource ACLs, per-connector mirror (D6)
- [ ] Retention/rate-limit ENFORCEMENT (G3/G4 sweeper+bucket), billing surface (G6), seat counting (G7), spend caps (G8)
- [ ] The pure "retrofit every knob into Control Room" + prompt-governance + cost-caps + scheduler (SEED-117 §1/§3 → v3.5 config pass)

---

## PART 7 — FEATURE PRIORITIZATION MATRIX

| Feature | User/Buyer Value | Impl. Cost | Priority |
|---|---|---|---|
| Org/dept/role schema (A1–A6) | HIGH | MEDIUM | P1 |
| Membership RLS rewrite + SECDEF audit (A7/A8) | HIGH (security thesis) | HIGH | P1 |
| Personal-org backfill (B1) | HIGH (nothing breaks) | HIGH | P1 |
| SAML SSO + JIT (B7/B4) | HIGH (enterprise gate) | MEDIUM | P1 |
| Invitations + adoption states (B2/B3/B5) | HIGH | MEDIUM | P1 |
| Profile anchor + org switcher (C1/C2) | HIGH | MEDIUM | P1 |
| Org-admin + dept-admin shells (C3/C4) | HIGH | HIGH | P1 |
| Role/group greenlists (E1–E3) | MEDIUM-HIGH | MEDIUM | P1 |
| Per-user preference layer (F1–F3) | MEDIUM | MEDIUM | P1 |
| Commercial footholds (G1–G4) | MEDIUM (revenue substrate) | MEDIUM | P1 |
| Folder-ACL sharing + retrieval filter (D3/3a/3b) | HIGH | HIGH | P1 |
| Permission-aware citations (D5/3c) | HIGH | HIGH | P2 (research-gated) |
| OIDC SSO (B8) | MEDIUM | HIGH | P2 |
| Dept-targeted skill availability (A12) | MEDIUM | MEDIUM | P2 |
| Pro/Enterprise refusal surface (G5) | LOW-MED | LOW | P2 |
| SSO enforcement / SCIM / impersonation | MEDIUM | HIGH | P3 |
| Custom role tiers / per-resource ACL | MEDIUM | HIGH | P3 |
| Retention/rate-limit enforcement, billing | MEDIUM | HIGH | P3 |

---

## PART 8 — COMPETITOR FEATURE ANALYSIS (org/RBAC lens)

| Capability | Glean | Beam AI | Classic DMS | Multi-tenant canon | Our v3.4 approach |
|---|---|---|---|---|---|
| Org / tenant model | Org + IdP groups | Workspace/team | Org + groups | `org_id` column + RLS (10k+ tenants) | Co-tenant `org_id` + RLS; isolation-via-deployment for enterprise |
| Departments / nesting | IdP-synced groups | Team | Folder-group inheritance | Team/dept scope | `departments` + nullable `parent_id`; one default dept per org |
| Role tiers | Setup/Admin/Super Admin + content-moderator | RBAC | Admin/curator/member | Per-org scoped roles | Fixed 4 tiers (super/org/dept-admin/member); custom = defer |
| Group→role / greenlists | Groups as principals, greenlist provisioning | RBAC | Group perms | Reusable permission sets | Generalize VIS-01 one-fn map → role/group greenlists |
| SSO | SAML/OIDC/SCIM sync | OAuth-scoped | SSO | IdP-federated | SAML CORE (native Supabase); OIDC STRETCH; SCIM defer |
| Onboarding states | not-invited/pending/active | invite | invite | invite | Adoption states on roster (Glean model) |
| Permission-aware retrieval | Per-request checks; source-ACL mirror; hide-documents | HITL governance | Folder inheritance | Retrieval-layer ACL (pre-filter) | Org-isolation CORE; folder-ACL filter CORE-adjacent; citations STRETCH |
| Audit | Search governance | Immutable per-action | Access logs | Per-tenant audit | Org-scoped audit view (extend existing log) |
| Packaging | ~$50/user, 100-seat min, Flex credits | Free/Starter/Enterprise | Per-user tiers | Tier + add-ons | 3-tier per-named-user + add-ons (columns + check foothold) |
| Data ownership | SaaS or customer-hosted | SaaS | On-prem/cloud | Varies | Self-host + env-var local↔cloud + RLS (edge) |

---

## Sources

**Glean (primary reference — own current docs, fetched 2026-07; HIGH):**
- [Administrator Roles](https://docs.glean.com/administration/identity/roles/admin-roles) — Setup/Admin/Super Admin tiers, Sensitive Content Moderator, CISO-gated Super Admin
- [Group-based permissions](https://docs.glean.com/administration/identity/roles/group-based-permissions) — greenlist-style provisioning, groups as principals, IdP sync cadence (SAML/SCIM near-real-time, OIDC ≤3h), precedence merge
- [About the Admin Console](https://docs.glean.com/administration/about) · [Agent Governance](https://www.glean.com/product/agent-governance) · [Citations](https://docs.glean.com/user-guide/assistant/glean-chat/glean-chat-citations/glean-citations) — permission-aware access, hide-documents, per-request checks (carried from the 2026-07-10 study)

**Beam AI (own marketing + reviews; MEDIUM):**
- [Platform](https://beam.ai/platform) · [How to audit AI agents](https://beam.ai/agentic-insights/how-to-audit-ai-agents-before-enterprise-security-review) — workspace/team RBAC + HITL governance + immutable audit

**Supabase (official docs, fetched 2026-07-18; HIGH):**
- [Enterprise SSO with SAML 2.0](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml) + [Enterprise SSO index](https://supabase.com/docs/guides/auth/enterprise-sso) — **SAML-only** for org SSO, Pro+, domain-routed, auto-provisioning toggle (OIDC NOT offered for enterprise SSO)
- [Self-hosted SAML SSO](https://supabase.com/docs/guides/self-hosting/self-hosted-saml-sso) — on-prem enterprise SSO path
- [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions) — **RLS on the chunks table is applied implicitly to similarity search**; join-table for many-to-many; "RLS is latency-sensitive — use the query plan analyzer"

**Permission-aware RAG (multiple sources agree; mechanism HIGH, perf-at-scale MEDIUM/unmeasured):**
- [Permission-aware retrieval must live in the vector layer (TianPan, 2026-05)](https://tianpan.co/blog/2026-05-04-permission-aware-retrieval-enterprise-rag-access-control) · [Pinecone — RAG access control](https://www.pinecone.io/learn/rag-access-control/) · [Cerbos — access control for RAG](https://www.cerbos.dev/features-benefits-and-use-cases/access-control-for-rag) — app-layer ACL leaks; pre-filter > post-filter

**Multi-tenant RBAC canon (cross-confirmed; HIGH):**
- [WorkOS — multi-tenant RBAC](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas) · [Auth0 — authorization model for multi-tenant SaaS](https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/) · [Clerk — multitenant SaaS architecture](https://clerk.com/blog/how-to-design-multitenant-saas-architecture) — org=tenant, per-org roles, tenant-column+RLS at our scale, fixed-vs-custom roles

**Internal (existing app — HIGH):** `.planning/PROJECT.md` (Current Milestone v3.4 scope cut) · SEED-004 (org multi-tenancy anchor) · SEED-115 (Glean/Beam ref + greenlist/doc-ACL shape) · SEED-113 (profile anchor) · SEED-099 (role-gated visibility) · SEED-080 (entitlement primitive) · SEED-117 §2 (preference layer) · `PRDs/v3.3-multi-tenancy.md` (stale brief — schema/RLS/SSO/shell shapes, migration range obsolete) · `PRDs/SEQUENCE.md` · `prd-reset/DECISIONS.md` (D-PRD-01/02/05/10) · prior `research/FEATURES.md` Part 1 (Glean/Beam study 2026-07-10) · CLAUDE.md.

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| Org/dept/role schema + one-schema-both-sizes | HIGH | Multi-tenant canon + SEED-004 + stale-PRD shape all agree; nullable-parent + default-dept is textbook |
| Onboarding (invitations, JIT, adoption states, backfill) | HIGH | Glean People model + Supabase auto-provisioning + established personal-org-backfill pattern |
| SSO protocol reality (SAML native, OIDC not) | HIGH | Supabase official docs fetched today, confirmed twice — revises the stale PRD |
| App-shell surfaces (profile anchor, switcher, shells) | HIGH | SEED-113 + Phase-146/148 substrate + stale-PRD 7-tab shape |
| Glean reference model (tiers/greenlists/permission-aware) | MEDIUM-HIGH | Own current docs fetched 2026-07; some agent-governance claims marketing-glossy |
| Feature visibility greenlists (VIS-01 generalization) | HIGH | VIS-01 is the literal seed; Glean greenlist mechanism confirmed |
| Per-user preference layer | HIGH | SEED-116 pattern resolved; `user_settings.preferences` column exists |
| Commercial footholds | MEDIUM-HIGH | D-PRD-10 locked; SEED-080 owns the check; scope-cut keeps it to footholds |
| Permission-aware RAG (retrieval filter) | HIGH mechanism / MEDIUM perf | RLS+pgvector native mechanism is documented; RLS+ivfflat/hnsw latency/recall at our scale is UNMEASURED → research gate |
| Permission-aware RAG (citation-surface leak) | MEDIUM | CITE-01 interaction is real and leak-critical but unbuilt; needs a threat-model spike |

## Gaps to address in phase-specific research
- **pgvector + RLS benchmark** (latency + ANN recall under a folder-visibility predicate) — gates the permission-aware-citations STRETCH; no vendor guidance exists.
- **CITE-01 leak threat model** — can a citation chip name/preview a doc the asker can't open? Needs the hide-documents / check-access design before promising "only cites what you can access."
- **RLS rewrite blast radius** — the live table count grew past the stale PRD's "18" (v2.7–3.0 added workflow/workspace/todos/doc-mgmt tables); re-author against live schema before planning (already flagged in PROJECT.md).
- **OIDC enterprise SSO** — if a customer needs OIDC, scope the custom Authlib SP; not native to Supabase.
- **Dept UX threshold** — when does a small org "graduate" to visible departments? Roles-before-departments (SEED-115) suggests deferring dept UI until a customer needs nesting.

---
*Feature research for: v3.4 Multi-Tenancy & Org Access (Agentic-RAG platform)*
*Researched: 2026-07-18*
