# Requirements: Agentic RAG — v3.4 Multi-Tenancy & Org Access

**Defined:** 2026-07-18
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

> **Milestone framing.** v3.4 turns Agentic RAG from a per-user app into an org-aware multi-tenant platform — the load-bearing **one-way RLS door** that unlocks the hybrid SaaS posture (D-PRD-02): co-tenant (`org_id` + membership RLS) by default, isolation-via-deployment for enterprise. Research (re-authored against the live schema at migration head 103 — see `.planning/research/SUMMARY.md`) established the milestone is a **two-front atomic war**: RLS is *decorative* today (a service-role client bypasses it; the real boundary is ~253 hand-written `.eq("user_id")` filters), so the RLS predicate rewrite is inert unless the per-request user-JWT client swap lands in the SAME phase. Numbering continues from 159 → **v3.4 phases start at 160**; migrations continue from **slot 104**.
>
> **Scope structure** follows this project's CORE-committed + STRETCH-gated convention (v2.9 / v3.1 / v3.2 / v3.3 precedent): STRETCH ships only if CORE lands clean and budget remains.

## CORE Requirements (committed)

Requirements for the v3.4 release. Each maps to exactly one roadmap phase.

### Governance

- [x] **ADR-01**: A written Tenancy-Model ADR ratifies the co-tenant (`org_id` + membership RLS) default + isolation-via-deployment-for-enterprise posture (D-PRD-02), locks the `skills.is_system` → `is_system_global` reuse and the 104+ migration renumbering, and does NOT re-litigate a decision v3.3's shipped `org_id` stubs + deploy presets already ~80% pre-decided. *(No code — ratification only.)*

### Org Foundation

- [x] **ORG-01**: The org/dept/role/membership schema ships — `organizations` (incl. `subscription_tier` + `add_ons jsonb` from day one), `departments` (nullable `parent_id` self-FK; one auto-created default department per org so a 5-person team and a 2,000-person org share ONE schema), `org_members`, `dept_members`, `roles` + `role_permissions` with a **fixed 4-tier** role enum (super-admin / org-admin / dept-admin / member) — all with RLS, FKs, and indexes from creation.
- [x] **ORG-02**: A `current_user_org_ids()` `SECURITY DEFINER` helper + a non-recursive self-rows-only policy on `org_members` prevent infinite RLS recursion (`42P17`); every other table's membership predicate calls the helper rather than inlining a subquery against `org_members`.

### Tenancy Isolation — the atomic crux

- [x] **TEN-01**: Every RLS predicate on all 38 user-facing tables is rewritten from `user_id = auth.uid()` to membership-based (`org_id = ANY(current_user_org_ids()) AND (owner-within-org OR is_org_shared OR dept-scoped OR is_system_global)`), shipped atomically across reviewable per-cluster bundles.
- [x] **TEN-02**: The service-role Supabase singleton is replaced on hot paths by a per-request user-JWT DB context across **both** data-access paths — supabase-py (JWT-header swap) and the raw asyncpg pool (`SET LOCAL request.jwt.claims` + the mandatory `SET LOCAL ROLE authenticated`) — with a hardened `get_service_role_supabase(org_id)` wrapper (refuses to construct without an explicit org) retained only for legitimate cross-tenant ops. **Ships in the same phase as TEN-01** (RLS is inert without it).
- [x] **TEN-03**: All four `SECURITY DEFINER` retrieval/sharing functions (`match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible`→`folder_is_org_shared`) carry an explicit org predicate in-body + a pinned `search_path`; the fragile `_inject_user_id` regex is **deleted** (not extended) and `query_user_documents` is called through the user-JWT client.
- [x] **TEN-04**: `org_id` is denormalized onto `document_chunks` and `skill_embeddings` (the pgvector hot paths) with a partial/composite index alongside the existing vector index, benchmarked so membership-RLS does not regress the CONCUR-01 <1s cross-tab-GET-during-streaming binding gate.
- [x] **TEN-05**: A cross-org isolation test suite (`test_v3_4_org_isolation.py`) — two seeded orgs × every user-facing table × all four `SECURITY DEFINER` functions (0 cross-org rows) × both DB access paths × `X-Org-Id` header-spoof rejection — passes, and is the milestone exit gate.
- [x] **TEN-06**: SEED-091 closed — global/org-shared resources (folders / skills / views) null the seeding owner's `user_id` (+ scope UUIDs) for non-owner readers in every list/serialize path.

### Permission-Aware Retrieval

- [x] **PRAG-01**: Retrieval is org- and folder-ACL-isolated — `document_chunks` RLS mirrors the full folder-visibility predicate so hybrid search returns only rows the asking user may access (a near-free byproduct of authoring TEN-01/TEN-03 correctly; a latent cross-org leak if omitted).

### Data Migration — "nothing breaks"

- [x] **MIG-01**: A personal-org backfill silently gives every existing user one personal org + default department + org-admin membership; `org_id` is backfilled across every table (batched ~10k-row windows, idempotent on `WHERE org_id IS NULL`, resolving owner-less child tables through their parent FK) and flipped `NOT NULL` only after verified zero-NULL — all existing data preserved, no user action required.
- [ ] **MIG-02**: `is_global` is retired via a value-preserving `RENAME` to `is_org_shared` (never drop+add) + an `is_system_global` allow-list that reuses the write-locked `skills.is_system` marker so the seeded `skill-creator` stays cross-org visible.

### Org Administration

- [ ] **ADMIN-01**: An org-admin shell ships with Members/Invitations · Departments/Roles · SSO · Audit · Subscription · Retention · Settings tabs, gated on the `org:manage` permission (reusing the shipped v3.3 Control-Room shell pattern as composition). *(G-2 sketch-gated.)*
- [ ] **ADMIN-02**: A multi-org user sees an org switcher; switching changes active-org context for all subsequent calls via a hybrid mechanism (membership set baked into the JWT for RLS + a server-validated `X-Org-Id` header for the active org); `<OrgContext>` wraps OUTSIDE `StreamsProvider` and an org switch tears down in-flight subscriptions + refetches (Realtime is best-effort, never the isolation boundary).
- [ ] **ADMIN-03**: A profile-menu identity anchor (name / email / role badge / sign-out) is the user-side counterpart to the Phase-146 operator shield (SEED-113). *(G-2 sketch-gated.)*
- [ ] **ADMIN-04**: An org-scoped audit view lets an org-admin (with `org:audit_view`) see all members' audit rows within their org; a member sees only their own.
- [ ] **ADMIN-05**: The Settings IA split resolves SEED-116 — personal preferences move to the profile menu, org config lives behind `org:manage`, and platform config stays in the Control Room.

### Onboarding

- [ ] **INV-01**: An org-admin can send email + link-based invitations (`org_invitations`, hashed token, expiry, `resend`/SES/`none`-log env-switched provider); recipients accept via sign-in or sign-up; adoption states (not-yet-invited / pending / active) render on the Phase-148 roster.
- [ ] **INV-02**: JIT provisioning creates the `org_members` row idempotently (`INSERT … ON CONFLICT DO NOTHING` + advisory lock so concurrent first-logins converge to one membership) on the signup / SSO-callback path.

### SSO

- [ ] **SSO-01**: An org-admin can register a SAML 2.0 IdP via Supabase's native SAML SP (Cloud Pro+ managed OR self-hosted GoTrue, un-gated); users route by email domain; attribute→claim mapping feeds department import; JIT provisioning (INV-02) creates membership on first login; email/password fallback is **retained** (SSO enforcement explicitly deferred). *(No `python3-saml` — Supabase owns the SAML parsing.)*

### Access Projection & Preferences

- [ ] **VIS-01**: Feature visibility generalizes the shipped binary "Everyone | Operators-only" audience map into per-feature role/group **greenlists**, resolved through the SAME one swappable `require_visible` function VIS-01 (v3.3) already built, with a Glean-style precedence-merge rule (highest role wins for primary tier, union for secondary grants).
- [ ] **VIS-02**: A per-user preference layer revives the dead `user_settings.preferences` column (unused since mig 011) under the SEED-116 two-layer pattern — a user picks a default (e.g. model) WITHIN the operator/org-allowed set, honoring operator lock flags.

## STRETCH Requirements (gated behind CORE)

Ship only if CORE lands clean and budget remains (v2.9 105–109 / v3.1 125–131 / v3.2 138–144 / v3.3 156–159 precedent).

### Org Administration

- **ADMIN-06**: A narrower dept-admin shell (Dept Members / Dept Skills / Dept Retention / Dept Audit) gated on `dept:manage`.

### Commercial Footholds

- **ENT-01**: A reusable entitlement-check primitive (`require_tier()` / `require_add_on()`) reading `orgs.subscription_tier` / `add_ons`, replacing the currently-lying `_is_tier_pro_or_higher` stub that returns `True` unconditionally (SEED-080). *(Enforcement footholds only — no billing/checkout.)*
- **ENT-02**: Per-org retention + rate-limit **data layer + org-admin UI** (schema + surfaces only; the sweeper / token-bucket enforcement is deferred to v3.5 / v3.6).

### Permission-Aware Retrieval

- **PRAG-02**: Permission-aware **citations** — an answer never cites/previews a document the asking user cannot open. Research-gated on a CITE-01 leak threat model + an unmeasured pgvector+RLS latency/recall benchmark, and depends on dept/role folder-sharing landing and stabilizing first.

### SSO

- **SSO-02**: OIDC enterprise SSO via a custom Authlib service provider — the one org-SSO protocol Supabase does NOT offer natively. Built only if a customer forces OIDC into scope.

### Access Projection

- **VIS-03**: Department-targeted skill / automation availability (fold in if skills RLS is being rewritten anyway).
- **VIS-04**: Admin tiers assignable to groups + per-group beta / feature-rollout gating.

## Out of Scope

Explicitly excluded — documented to prevent scope creep. Anti-features from research carry their warning.

| Feature | Reason |
|---------|--------|
| Cross-org sharing | Re-opens the exact leak class this milestone closes; the ONLY legitimate cross-org visibility is the seeded `skill-creator` `is_system_global` allow-list |
| Custom / arbitrary role tiers | Fixed 4 tiers; org-admins extend permission *grants*, not role *tiers* — custom tiers defer to a later milestone |
| SCIM provisioning | SAML + OIDC JIT covers v1 enterprise onboarding; SCIM lands when a customer requires directory-driven offboarding |
| Per-resource ACLs finer than folder-level | v3.4 ships dept-scoped + org-shared + folder-ACL visibility, not per-document/per-object ACLs |
| Per-connector source-ACL mirroring | We have no ingestion connectors to mirror (manual upload only) |
| SSO enforcement (no password fallback) | v3.4 ships SSO + fallback; enforcement is a later add-on once the fallback path is proven |
| Billing / checkout surface | `subscription_tier` schema ships; payment collection is out of scope |
| Retention / rate-limit **enforcement** | Data layer + UI ship as footholds (ENT-02 STRETCH); the sweeper / Redis token-bucket is v3.5 / v3.6 |
| Impersonation ("sign in as user") | Deferred with a named trigger — a role-scoped, heavy-audit capability that belongs with the roles work |
| Pure config-retrofit (SEED-117 §1/§3 — retrofit every remaining knob into Control Room tabs, prompt governance, cost/budget caps, scheduler) | Deferred to a v3.5 config pass — those knobs get org-scoped by the RLS rewrite anyway; the scheduler is v3.6 Automations (SEED-014); cost-caps need duration telemetry (SEED-023) |
| Multi-region / per-org data residency | Single-region per Supabase instance; enterprise data residency is served by the isolation-via-deployment tier (customer-owned Supabase) |
| `python3-saml` / hand-rolled SAML SP | Redundant — Supabase Auth IS the SAML SP; avoids the `xmlsec1` CVE surface entirely (research-corrected from the stale brief) |
| Chat-surface reported-bug backlog (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04, …) | Belongs to the separate planned post-v3.3 chat-polish phase, not multi-tenancy; only SEED-091 (TEN-06) folds here |

## Traceability

Populated during roadmap creation (each requirement maps to exactly one phase; numbering continues from 159 → 160+).

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADR-01 | 160 | Complete |
| ORG-01 | 161 | Complete |
| ORG-02 | 161 | Complete |
| MIG-01 | 162 | Complete |
| TEN-01 | 163 | Complete |
| TEN-02 | 163 | Complete |
| TEN-04 | 163 | Complete |
| TEN-03 | 164 | Complete |
| TEN-05 | 164 | Complete |
| TEN-06 | 164 | Complete |
| PRAG-01 | 164 | Complete |
| MIG-02 | 165 | Pending |
| ADMIN-01 | 166 | Pending |
| ADMIN-02 | 166 | Pending |
| ADMIN-03 | 166 | Pending |
| ADMIN-04 | 166 | Pending |
| ADMIN-05 | 166 | Pending |
| INV-01 | 167 | Pending |
| INV-02 | 167 | Pending |
| VIS-01 | 167 | Pending |
| VIS-02 | 167 | Pending |
| SSO-01 | 168 | Pending |
| ADMIN-06 | 169 | Pending (STRETCH) |
| ENT-01 | 170 | Pending (STRETCH) |
| ENT-02 | 170 | Pending (STRETCH) |
| PRAG-02 | 171 | Pending (STRETCH) |
| SSO-02 | 172 | Pending (STRETCH) |
| VIS-03 | 173 | Pending (STRETCH) |
| VIS-04 | 173 | Pending (STRETCH) |

**Coverage:**
- CORE requirements: 22 total — **22/22 mapped** (Phases 160-168) ✓
- STRETCH requirements: 7 — **7/7 mapped** (ADMIN-06→169 · ENT-01/02→170 · PRAG-02→171 · SSO-02→172 · VIS-03/04→173) ✓
- Mapped to phases: **29/29** ✓ (every requirement → exactly one phase; 0 orphans, 0 duplicates)
- Unmapped: **0** ✓

---
*Requirements defined: 2026-07-18 (research-first; scope + CORE/STRETCH split operator-approved)*
*Last updated: 2026-07-18 — traceability populated by roadmapper (ROADMAP.md v3.4 created; 29/29 mapped across Phases 160-173)*
