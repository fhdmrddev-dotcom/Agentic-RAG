# Project Research Summary

**Project:** Agentic RAG — v3.4 Multi-Tenancy & Org Access
**Domain:** Org-level multi-tenancy retrofit (membership-based RLS + SSO) onto an existing single-tenant, per-user Agentic RAG platform (React/Vite + FastAPI + Supabase/Postgres/pgvector + Redis)
**Researched:** 2026-07-18
**Confidence:** HIGH

## Executive Summary

v3.4 turns Agentic RAG from a per-user app into an org-aware multi-tenant platform — the load-bearing one-way-door milestone that unlocks the hybrid SaaS posture already locked in D-PRD-02 (co-tenant `org_id`+RLS by default, isolation-via-deployment for enterprise). All four researchers independently converged on the same headline fact, verified against the live schema (`full-schema.sql` @ migration head 103, not the stale 2026-05-10 PRD): **today RLS is decorative.** The backend runs on a service-role Supabase singleton that unconditionally bypasses RLS; the actual per-user boundary is ~253 hand-written `.eq("user_id", …)` filters across 32 files. This means the milestone is a **two-front atomic war**, not a schema migration: Front A (rewrite every RLS predicate to membership-based) is worthless unless Front B (swap the service-role client for a per-request user-JWT client) lands in the *same* phase — and Front B itself splits into two distinct fixes, because this codebase has two DB access paths: supabase-py/PostgREST (fixed by a JWT-header swap) and the raw asyncpg pool (fixed only by `SET LOCAL request.jwt.claims` + the load-bearing `SET LOCAL ROLE authenticated` — the *role* switch, not the claims, is what actually turns RLS on, since the pool's DSN role is a table owner that has BYPASSRLS regardless of what claims are set).

The recommended approach sequences schema-additive → personal-org backfill → the atomic RLS+client-swap (the crux phase, gated on a live two-user leak test since the exact `set_config`/`SET LOCAL` semantics aren't fully nailed down by docs) → a four-function `SECURITY DEFINER` retrieval audit (the stale brief named only `match_document_chunks`; `keyword_search_chunks`, `match_skills`, and `folder_is_globally_visible` are equally live leak surfaces, and `query_user_documents` is a *different* bug — already `SECURITY INVOKER`, but called through the service-role client and "protected" only by a regex that a CTE/subquery defeats) → `is_global` retirement → org-admin UI → invitations/roles/greenlists → SSO last. SSO itself is cheap: Supabase Auth **is** the SAML 2.0 service provider, so the stale brief's marquee dependency (`python3-saml`, and its `xmlsec1` system dep + CVE surface) is dropped entirely — net new hard deps for the whole milestone are 0–2 packages. Permission-aware RAG is not a binary CORE/STRETCH call: org-level retrieval isolation is inseparable from the RLS rewrite (CORE), the intra-org folder-ACL retrieval *filter* is a near-free byproduct of authoring the same predicate correctly (fold into CORE), and only the "citations never name a doc you can't open" guarantee is a genuinely research-gated STRETCH pending a CITE-01 threat model and an unmeasured pgvector+RLS latency/recall benchmark.

Key risks, in order of severity: shipping RLS policies while a service-role or asyncpg-owner connection still bypasses them (false confidence — the single most-cited trap across all four files); scoping only one of the four `SECURITY DEFINER` retrieval functions; infinite RLS recursion on `org_members` itself (`42P17`) if the membership predicate isn't broken by a `SECURITY DEFINER` helper; a missing `org_id` column and index on `document_chunks` (the pgvector hot path — mig 096 deliberately shipped zero `org_id` indexes) threatening the CONCUR-01 <1s binding gate; and a non-idempotent, unbatched personal-org backfill that lock-storms production or silently drops `is_global` sharing. Mitigation is structural, not procedural: treat the RLS+client-swap as one atomic, un-splittable phase; audit *every* `SECURITY DEFINER` function in the live schema, not the PRD's list; and gate the milestone's exit on a two-org adversarial test suite (`test_v3_4_org_isolation.py`) exercising all 38 user-facing tables, all four DEFINER functions, both DB access paths, and header-spoof rejection — "looks isolated" from a one-org test suite is worthless, because every existing fixture is single-tenant by construction and would stay green even if isolation were completely broken.

## Key Findings

### Corrections to the Stale Brief (re-authored against the live schema, head 103)

Three of four researchers independently re-verified the codebase directly rather than trusting `.planning/PRDs/v3.3-multi-tenancy.md` (authored 2026-05-10, predates v2.7–v3.3). Do not carry these stale numbers into planning:

| Stale brief claimed | Live-verified reality | Source |
|---|---|---|
| "18 user-facing tables" | **38** user-facing tables (42 total minus 4 non-user-facing: `app_settings`, `model_capabilities_overrides`, `operator_users`, `operator_audit_log`) | ARCHITECTURE §1 |
| "4 owned roots carry the `org_id` stub" | **12** user-facing tables already carry an `org_id` column — mig 096 (v3.3) stubbed 4 owned roots (documents/folders/threads/skills, **no index, no FK, no backfill**); the v3.0 DM + v2.8 harness/workflow era independently stubbed 8 more | ARCHITECTURE §1.2 |
| Migration range 075–094; phases 088–100 | Live migration head is **103**; next free slot is **104**. Phase numbers continue from 159 → v3.4 starts at **160** | ARCHITECTURE header; PITFALLS header |
| Milestone slot "v3.2/v3.3" | Authoritative slot is **v3.4** per `PRDs/SEQUENCE.md:21` | ARCHITECTURE header |
| `python3-saml` as our SAML SP | **Supabase Auth IS the SAML SP** (native SAML 2.0) — drop `python3-saml` entirely | STACK headline |
| "rewrite `query_user_documents` SECURITY DEFINER → INVOKER" | It is **already INVOKER** (mig 012, day one). The real leak is the service-role *caller* + a Python regex (`_inject_user_id`) that only scopes the first `WHERE` clause | PITFALLS #3 |
| Retrieval bypass = `match_document_chunks` alone | **Four** `SECURITY DEFINER` functions gate retrieval/sharing: `match_document_chunks`, `keyword_search_chunks` (the hybrid-search "twin" the brief missed), `match_skills`, `folder_is_globally_visible` | ARCHITECTURE §2; PITFALLS #2 |
| "SAML + OIDC both via Supabase" | Supabase enterprise SSO is **SAML-only**; per-org OIDC is not offered as an org-SSO protocol | STACK Q1; FEATURES B8 |

### Recommended Stack

**Headline: v3.4 adds ~0–2 new hard runtime dependencies.** The biggest change is a *pattern* (per-request user-JWT DB context), not a pile of libraries. Confidence HIGH — versions, the Supabase SAML tier structure, self-hosted GoTrue, and the asyncpg RLS pattern are all verified against official docs; MEDIUM on the per-org-OIDC gap and the exact `set_config`/`SET LOCAL` flag semantics (both explicitly flagged for a live verification spike).

**Core technologies:**
- **Supabase Auth native SAML 2.0** (platform feature, Cloud Pro+ / self-hosted GoTrue un-gated) — we do NOT hand-roll a SAML SP; multi-tenant per-org connections provisioned via `supabase sso add` (CLI-only — the dashboard exposes one field). Eliminates `python3-saml`/`xmlsec1` and their CVE surface entirely.
- **asyncpg `SET LOCAL` per-request RLS context** (pool already exists, `dependencies.py::get_pg_pool`) — the load-bearing new *pattern*: `SET LOCAL request.jwt.claims` + the mandatory `SET LOCAL ROLE authenticated` inside a transaction. No new pool, no new dependency.
- **PyJWT** (already transitive via `gotrue`, promote to an explicit pin) — local JWKS/ES256 verification via `PyJWKClient`, drops the per-request GoTrue round-trip and yields the claims dict `set_config` needs.
- **Authlib 1.7.2** *(scope-gated — only if per-org OIDC ships in v1)* — the one thing Supabase per-org SSO does NOT cover.
- **resend 2.34.0** *(cloud default, env-switched)* — transactional invitation email; `none`/log-only for local dev, `boto3`/SES only for enterprise-on-AWS.
- **Supabase custom-access-token hook** — bakes the user's org **membership set** into the JWT for cheap RLS (no per-request join); the **active org** rides a separately-validated `X-Org-Id` header instead (avoids forcing a token refresh on every org switch). This hybrid is the recommended org-switcher mechanism.

**What NOT to use:** `python3-saml`/`xmlsec1` (redundant — Supabase is already the SP); a second Postgres pool/pgbouncer layer for tenancy (reuse `get_pg_pool`); baking the *active* org into the JWT (forces a refresh on every switch); leaving the service-role client on hot paths (the current leak); SCIM libraries (YAGNI until a customer needs directory-driven offboarding); a policy engine like Casbin/oso/Permit.io (fights the Postgres-RLS model the whole design rests on); new frontend SSO packages (`supabase-js` already ships `signInWithSSO`).

### Expected Features

Confidence MEDIUM-HIGH (Glean/Supabase/multi-tenant-canon claims from vendors' own current docs = HIGH; some Glean agent-governance marketing copy = MEDIUM; existing-app facts = HIGH). Glean is the primary reference competitor (D-PRD-05) and maps almost 1:1 onto this milestone's three problems: (1) org/dept/group model + SSO import, (2) admin tiers + role/group "greenlist" feature gating, (3) permission-aware document access — collapsed here to folder-level ACL since we have no connectors to mirror.

**Must have (CORE-v1, operator-approved scope):**
- Org/department/role/membership schema — `organizations`, `departments` (nullable `parent_id` self-FK for free nesting), `org_members`, `dept_members`, a **fixed 4-tier role enum** (super-admin/org-admin/dept-admin/member — NOT arbitrary custom tiers), `role_permissions`. The "one schema serves a 5-person team AND a 2,000-person org" trick: every org auto-gets one default department; small orgs never touch `dept_members`, large orgs nest freely — zero schema change either way.
- Membership-based RLS predicate rewrite + per-request user-JWT client + `SECURITY DEFINER→INVOKER` audit — its own phase, folds SEED-091 (global-resource owner-UUID disclosure).
- Personal-org backfill migration — every existing user silently gets their own org; "nothing breaks" is the contract.
- Email + link invitations, adoption states (not-yet-invited/pending/active, Glean's model) on the existing Phase-148 roster.
- **SAML 2.0 SSO** + JIT provisioning (native Supabase) — OIDC is STRETCH (see SSO note below).
- Profile identity anchor + org switcher (SEED-113) — the user-side counterpart to the Phase-146 operator shield; G-2 sketch-gated.
- Org-admin 7-tab shell (Members/Invitations, Departments/Roles, SSO, Audit, Subscription, Retention, Settings) + a narrower dept-admin shell + org-scoped audit view + a Settings IA split (personal → profile menu, org → `org:manage`, platform stays in Control Room, resolving SEED-116).
- Role/group feature greenlists — **generalizes the already-shipped VIS-01** binary "Everyone | Operators-only" audience into a per-feature set that lists roles/groups, resolved through the same ONE swappable function VIS-01 already built. This is the cheapest CORE item in the whole milestone because the seed is already built.
- Per-user preference layer — revives the dead `user_settings.preferences` column (unused since mig 011) under the SEED-116-resolved two-layer allowed-set→preference pattern.
- Commercial footholds — `subscription_tier`/`add_ons jsonb` columns + a reusable entitlement-check primitive (`require_tier()`/`require_add_on()`, SEED-080, replacing the currently-lying `_is_tier_pro_or_higher` stub that returns `True` unconditionally) + retention/rate-limit data-layer + admin UI. **Enforcement is explicitly deferred** — these ship as footholds only.
- Folder-level ACL sharing to dept/role + the org-level and folder-ACL retrieval *filter* (see the permission-aware-RAG split below — this half folds into CORE).

**Should have / STRETCH (research-gated or first-to-cut):**
- **Permission-aware citations** — "cites only what you can access." Gated on a CITE-01 leak threat model + an unmeasured pgvector+RLS latency/recall benchmark, and on the dept/role folder-sharing model landing and stabilizing first.
- OIDC enterprise SSO via a custom Authlib SP.
- Department-targeted skill/automation availability (fold in if skills RLS is already being rewritten anyway).
- Admin tiers assignable to groups; per-group beta/feature-rollout gating.
- An honest, single-component "this is a Pro/Enterprise feature" refusal surface.

**Anti-features (explicitly NOT built, permanent or long-defer):** cross-org sharing (re-opens the exact leak class the milestone closes — the only legitimate cross-org visibility is the seeded `skill-creator` allow-list); custom/arbitrary role tiers (fixed 4 now, org-admins extend *grants* not *tiers*); SCIM provisioning; per-resource ACLs finer than folder-level; per-connector source-ACL mirroring (we have no connectors); SSO *enforcement* with no password fallback; a billing/checkout surface; retention/rate-limit *enforcement* (data layer ships now, the sweeper/token-bucket is v3.5/v3.6); impersonation without heavy audit.

**SSO note (revises the stale PRD, HIGH confidence):** Supabase enterprise SSO supports **SAML 2.0 only**, routed by email domain, Pro+ on Cloud (50 SSO MAUs included, then $0.015/MAU) but **un-gated on self-hosted GoTrue** — which is exactly the isolation-via-deployment enterprise tier, so the "expensive" tier gets SSO for free. OIDC exists only as a per-app *social* login provider, never a domain-routed per-org SSO flow. → **SAML = CORE, OIDC = STRETCH**, never promise "both native."

### Architecture Approach

The rewrite is a **two-front atomic war** across 38 user-facing tables (not 18), and the two fronts must land in the same phase:

**Front A — Data layer (RLS):** rewrite every predicate from `auth.uid() = user_id` to a membership shape — `org_id = ANY(current_user_org_ids()) AND (user_id = auth.uid() OR is_org_shared OR is_system_global)` — across 38 tables / 110 policies / 6 `is_global` columns / 4 Storage-bucket policy sets / ~9 scoping functions. The `org_members` table needs its *own* non-recursive policy (gated on `user_id = auth.uid()` only) plus a `SECURITY DEFINER` helper (`current_user_org_ids()`) that every *other* table's policy calls — inlining a subquery against `org_members` on `org_members`'s own policy causes infinite recursion (`42P17`).

**Front B — App layer (the real gate):** replace the service-role singleton (`dependencies.py:21-25`) on hot paths with a per-request user-JWT client. This is **two distinct fixes**, not one uniform swap, because two DB access mechanisms coexist: supabase-py/PostgREST (fixed by overriding the `Authorization` header / `postgrest.auth(jwt)`) and the raw asyncpg pool added in Phase 073 (fixed only by `SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated` inside each transaction — there is no "JWT client" equivalent for a raw connection pool). Service-role is retained, but only behind a hardened `get_service_role_supabase(org_id)` wrapper that refuses to construct without an explicit org, for the genuinely cross-tenant paths: SSO JIT provisioning, org-admin cross-member reads, and the ~half of this app's writes that already run fully async/service-role with no `auth.uid()` at all (agent loop, eval runner, harness engine, re-embed job) — those keep service-role but their `.eq("user_id")` filters must widen to org-aware.

**Major components (new):**
1. **8 org tables** (`organizations`, `departments`, `org_members`, `dept_members`, `roles`/`role_permissions`, `org_invitations`, `sso_configs`) + `current_user_org_ids()` SD helper — RLS-from-day-one, zero behavior change on creation.
2. **`get_user_supabase(request)` factory + asyncpg `SET LOCAL` wrapper** in `dependencies.py` — the per-request RLS-enforcing client, the single seam Front B hangs off.
3. **4-function `SECURITY DEFINER` retrieval/sharing audit** — `match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible`→`folder_is_org_shared` — each needs an org predicate inside the body (DEFINER functions ignore table RLS entirely; the inlined `WHERE` clause is the *only* gate) plus a pinned `search_path` (currently missing on the two chunk-search functions — a privilege-escalation vector via search-path hijack).
4. **`<OrgContext>` provider + org switcher + profile-menu anchor** (frontend) — the hybrid JWT-membership-set + `X-Org-Id`-header-active-org pattern; wrapped **outside** `StreamsProvider` so streams can read active org without regressing the Phase-067.5 Branch-D3 clear guard.
5. **Cross-org isolation test suite** (`test_v3_4_org_isolation.py`) — the exit gate: two seeded orgs, every table, all 4 DEFINER functions, both DB access paths, header-spoof rejection.

**The two known perf cliffs:** mig 096 shipped the 4 owned-root `org_id` stubs with **zero indexes** ("follows the leaner harness_audit shape"), and `document_chunks` — the pgvector hot path — has **no `org_id` column at all** (it inherits org only by joining `documents`). A membership-join RLS predicate evaluated per-row over a sequential scan on the hottest retrieval table is the single largest threat to the CONCUR-01 <1s binding gate; the fix is to denormalize `org_id` directly onto `document_chunks` (and `skill_embeddings`) and add a partial/composite index alongside the existing HNSW vector index, benchmarked before merge.

### Critical Pitfalls

Confidence HIGH on codebase-specific traps (verified live against `full-schema.sql`, `dependencies.py`, `sql_service.py`, mig 096); HIGH on the SSO CVE class; MEDIUM on supabase-py per-request-JWT ergonomics (correct pattern, unbenchmarked in this codebase).

1. **The service-role singleton (and the asyncpg owner-role connection) silently bypass any new RLS.** Writing beautiful membership policies and shipping them changes nothing if `get_supabase()` — or a privileged asyncpg DSN role — still services the hot paths; the tests stay green because they seed one org, and a forgotten filter leaks *every* org. Fix: ship the client swap (both paths) in the SAME atomic phase as the predicate rewrite — never "policies now, client later." `SET LOCAL ROLE authenticated` is the mandatory piece that actually turns RLS on; the claims alone do nothing against a BYPASSRLS-privileged role.
2. **The retrieval bypass surface is four `SECURITY DEFINER` functions, not one.** Fixing only `match_document_chunks` leaves `keyword_search_chunks` (hybrid search's other leg — the stale brief's blind spot) and `match_skills` (whose own comment calls itself "the ONLY cross-user gate — never widen it") leaking cross-org exactly as badly. All four need the org predicate *and* a pinned `search_path` in one audit.
3. **`query_user_documents` is already `SECURITY INVOKER` — the leak is the service-role caller plus a regex.** Planning "rewrite it to INVOKER" wastes the phase; the actual fix is calling the RPC through a user-JWT client and *deleting* `_inject_user_id` (a Python regex that string-interpolates a `user_id` predicate into model-generated SQL and only scopes the first `WHERE` clause — a CTE or subquery sails through unscoped). Extending the regex to also inject `org_id` doubles the fragility instead of fixing it.
4. **Recursive RLS on `org_members` (`42P17`).** The natural membership predicate, copy-pasted onto `org_members`'s own policy, causes infinite recursion and 500s the first authenticated query in production. Fix: a `SECURITY DEFINER` helper function every *other* table calls, and a non-recursive, self-rows-only policy on `org_members` itself.
5. **Missing `org_id` column/index on `document_chunks` threatens CONCUR-01.** Mig 096 shipped zero `org_id` indexes by design, and `document_chunks` has no `org_id` column at all — a per-row membership join over a sequential scan on the pgvector hot path regresses retrieval p95 and risks the <1s cross-tab-GET-during-streaming gate. Denormalize + index before merge, benchmark against the gate.
6. **Personal-org backfill lock storms, non-idempotency, and `is_global` data loss.** A single unbatched `UPDATE … SET org_id` table-locks production; flipping `NOT NULL` before the backfill completes fails or blocks writes; dropping/recreating `is_global` instead of a value-preserving `RENAME` silently "un-shares" every previously-global folder/skill (including the seeded `skill-creator`, breaking every user's skill catalog); a non-idempotent migration re-run (a normal recovery action under this project's SQL-editor-paste workflow) duplicates orgs/memberships. Fix: batch in ~10k-row windows gated on `WHERE org_id IS NULL`, verify zero-NULL before the `NOT NULL` flip, `RENAME COLUMN` not drop+add.

## Implications for Roadmap

Nine dependency-ordered phase **roles** (Architecture §8 and Pitfalls' role-tag table converge on nearly the same spine; SSO placement and the isolation-suite's exact position are the one real divergence — flagged under Research Flags). Migration numbers continue from the live head: **next slot = 104**. Phase numbers continue from 159: **v3.4 starts at 160**; the roadmapper maps these roles to concrete numbers.

### Phase 0: Tenancy-Model ADR (ratification, no code)
**Rationale:** The hybrid posture (D-PRD-02: co-tenant `org_id`+RLS default, isolation-via-deployment for enterprise) is already ~80% pre-decided by v3.3's shipped `org_id` stubs, org-agnostic `operator_users`, and Solo/Team/Enterprise deploy presets — this phase writes it down, it does not re-litigate.
**Delivers:** A written ADR; locks the `is_system`→`is_system_global` reuse and the migration renumbering (104+).
**Addresses:** Governance only — no FEATURES.md items.
**Avoids:** Re-opening a decision the architecture research shows is nearly free given existing substrate (enterprise "isolation" = today's app, re-pointed at a customer's own Supabase — zero new code, since the local↔cloud switch is already pure env-var).

### Phase 1: Org/Dept/Role Schema (additive, zero behavior change)
**Rationale:** Must exist before backfill or RLS can reference it; nullable-only columns keep this phase safe and reviewable.
**Delivers:** 8 new org tables with RLS from day one (`organizations`, `departments` w/ nullable `parent_id`, `org_members`, `dept_members`, `roles`/`role_permissions`, `org_invitations`, `sso_configs`); the `current_user_org_ids()` `SECURITY DEFINER` helper; nullable `org_id` added to the ~26 tables still lacking it.
**Addresses:** FEATURES A1–A6 (org/dept/role/membership schema, the default-dept "one schema, both sizes" design).
**Avoids:** Pitfall 4 (recursive `org_members` RLS) — ship the DEFINER helper and the non-recursive `org_members` policy in the *same* migration as the table, not as a follow-up.

### Phase 2: Personal-Org Backfill
**Rationale:** Must run after schema exists and before RLS goes live — this is the "nothing breaks, no user action" contract the whole milestone is sold on.
**Delivers:** One personal org + default dept + org-admin membership per existing user; batched (~10k-row windows), idempotent `org_id` backfill across every table (resolving through the parent FK for owner-less child tables); value-preserving `is_global`→`is_org_shared` `RENAME`; `NOT NULL` flip only after verified zero-NULL.
**Addresses:** FEATURES B1 (personal-org backfill).
**Avoids:** Pitfall 6 (lock storms, non-idempotent re-runs, `is_global` data loss, NOT-NULL-before-backfill ordering).

### Phase 3: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX
**Rationale:** The single highest-signal convergence across all four research files: RLS predicates and the client that makes them enforceable must land together or the milestone accomplishes nothing. Two data-access paths need two different fixes — supabase-py gets a JWT-header swap (no new pool); asyncpg gets a per-transaction `SET LOCAL request.jwt.claims` + the mandatory `SET LOCAL ROLE authenticated` (the role switch, not the claims, is what turns RLS on against a table-owner DSN role). `threads.py` is already G-5-firing (6+ prior phases on this hot file) — the guardrail requires the overdue extraction refactor be proposed FIRST, before threading `org_id` through the ~1850-LOC `send_message`.
**Delivers:** `get_user_supabase(request)` factory + the asyncpg `SET LOCAL` wrapper; membership RLS predicates across the 38 tables in ~6 reviewable bundles (documents / chat / skills / DM / workflow-eval / identity-audit clusters); `get_service_role_supabase(org_id)` hardened wrapper for legitimate cross-tenant ops; `org_id` denormalized + partial-indexed on `document_chunks` and `skill_embeddings`; `runs.org_id` set at creation.
**Uses:** asyncpg (already present), PyJWT + local JWKS verify, the Supabase custom-access-token hook (membership set in JWT) + `X-Org-Id` header (active org, server-validated) — the hybrid org-switcher.
**Addresses:** FEATURES A7 (RLS predicate rewrite), A8 (per-request client), A10 (org context on every request).
**Avoids:** Pitfalls 1, 4 (service-role and asyncpg bypass), 5 (missing index/column on `document_chunks` threatening CONCUR-01), 8 (deleting the now-belt-and-suspenders `.eq("user_id")` filters prematurely — keep them, this milestone), 11 (RED LINES: CONCUR-01 <1s, D-14 byte-identical, G-5 hot files, Redis `run:{run_id}` implicit org-scoping via `runs.org_id`).
**Gate:** A live two-user RLS leak test — the exact `SET LOCAL`/`is_local` semantics are flagged MEDIUM confidence by STACK.md (one source's claim judged "lossy"); do not trust documentation alone here.

### Phase 4: SECDEF Audit + Cross-Org Isolation Test Suite
**Rationale:** `SECURITY DEFINER` functions ignore table RLS entirely — they run with owner privilege and their inlined `WHERE` clause is the only gate. Must follow Phase 3 because the INVOKER rewrite of `match_document_chunks` needs `document_chunks` RLS/`org_id` live first.
**Delivers:** All four retrieval/sharing DEFINER functions scoped + `search_path` pinned (`match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible`→`folder_is_org_shared`); `_inject_user_id` regex **deleted** (not extended to `org_id`) with `query_user_documents` called via the user-JWT client; `test_v3_4_org_isolation.py` — two seeded orgs, every table, all four DEFINER functions (0 cross-org rows), both DB access paths, `X-Org-Id` spoof rejected. Folds **SEED-091** (global-resource owner-UUID disclosure — null owner fields in list/serialize paths for shared rows the caller doesn't own).
**Addresses:** FEATURES A8 (SECDEF audit); D4/3a+3b — org-level *and* folder-ACL retrieval isolation fall out "for free" once `document_chunks` RLS mirrors the full folder-visibility predicate authored in Phase 3.
**Avoids:** Pitfalls 2 (fixing 1-of-4 DEFINER functions), 3 (misdiagnosing `query_user_documents` as DEFINER), and the "one-org test false-green" trap (an isolation claim with no second tenant is unverified, not proven).

### Phase 5: `is_global` Retirement Cleanup
**Rationale:** Mechanical and low-ambiguity; can overlap Phase 4.
**Delivers:** `is_global`→`is_org_shared` rename complete across UI copy ("Global"→"Shared with org"), the Python `folder_utils.py` mirror of the SQL recursive-visibility walk, the Storage `skill-files` bucket policy's `is_global` branch, and an `is_system_global` allow-list reusing the pre-built, write-locked `skills.is_system` marker for the seeded `skill-creator`.
**Addresses:** FEATURES A9 (`is_global` retirement).
**Avoids:** Per-org copies of the skill-creator (a hardcoded, migration-only allow-list — never let a route set `is_system_global`).

### Phase 6: Org-Admin Shell + Org Switcher + Profile-Menu Anchor
**Rationale:** Meaningless before org isolation is real (sequenced after Phase 4); reuses the shipped v3.3 Control-Room shell almost entirely as composition. G-2 sketch-gated (live UI/panel/badge work).
**Delivers:** Profile identity anchor (name/email/role badge/sign-out — the user-side counterpart to the Phase-146 operator shield); org switcher on the hybrid JWT-membership + header-active-org pattern, `<OrgContext>` wrapped OUTSIDE `StreamsProvider`; org-switch teardown (abort in-flight subscriptions + refetch — Realtime is best-effort per D-v2.5-03, never trust its org filter as the isolation boundary); org-admin 7-tab shell (Members/Invitations, Departments/Roles, SSO, Audit, Subscription, Retention, Settings) gated on `org:manage`; org-scoped audit view; Settings IA split resolving SEED-116 (personal→profile menu, org→`org:manage`, platform stays in Control Room).
**Uses:** Existing shadcn/ui `<Select>`, the existing v3.3 admin shell pattern — no new frontend packages.
**Addresses:** FEATURES C1–C6 (identity anchor, org switcher, org-admin shell, org-scoped audit, Settings IA split).
**Avoids:** Pitfall 10 (stale streams painting across an org switch; `X-Org-Id` trusted from localStorage without a server-side `org_members` check).

### Phase 7: Invitations + Roles + Greenlists + JIT Provisioning
**Rationale:** Depends on the org/role schema (Phase 1) and the org-admin shell (Phase 6) for a UI home. Role/group greenlists generalize the already-shipped VIS-01 feature-visibility map — the literal seed (one swappable resolver function already exists) makes this cheap.
**Delivers:** Email + link invitations (`org_invitations`, hashed token, expiry, `resend`/SES/`none` env-switched provider); adoption states (not-yet-invited/pending/active) on the Phase-148 roster (already chip-shaped for this); role/group feature greenlists generalizing VIS-01's binary audience to roles/groups with Glean's precedence-merge rule (highest role wins for primary tier, union for secondary grants); the narrower dept-admin shell; idempotent JIT `org_members` creation (`INSERT … ON CONFLICT DO NOTHING`) wired into `handle_new_user` or the signup/SSO-callback path.
**Uses:** `resend` 2.34.0 (or SES/`none`) — env-driven, optional dependency.
**Addresses:** FEATURES B2/B3/B5/B6 (invitations, adoption states, roster), E1–E3 (greenlists), C4 (dept-admin shell).
**Avoids:** The JIT-race half of Pitfall 9 (idempotent insert + advisory lock so concurrent first-logins converge to one membership).

### Phase 8: SSO — SAML 2.0 CORE, OIDC STRETCH (last, first-to-cut)
**Rationale:** The only piece with a heavy external dependency (IdP config, CLI-only multi-tenant provisioning) and zero downstream dependents — cutting it still ships a usable multi-tenant platform, since invitations already cover onboarding.
**Delivers:** Supabase native SAML 2.0 SSO (Cloud Pro+ managed OR self-hosted GoTrue, un-gated) wired through the Phase-7 JIT seam; per-org SAML connections provisioned via the Supabase CLI (`supabase sso add`); attribute→claim mapping feeding department import; email/password fallback **retained** (SSO enforcement explicitly deferred).
**Uses:** Supabase Auth native SAML — 0 new hard deps, `python3-saml` dropped entirely; Authlib 1.7.2 ONLY if OIDC is pulled into v1.
**Addresses:** FEATURES B7 (SAML SSO), B4 (JIT provisioning).
**Avoids:** Pitfall 9, **as corrected** — see Gaps below; the surviving app-owned risks are JIT idempotency (already covered in Phase 7), OIDC discovery SSRF (only if Authlib/OIDC is built), and flipping SSO enforcement before the fallback path is proven (never in v3.4).

### Rounds out CORE-v1 scope (parallelizable, not on the atomic security-critical path)
FEATURES.md's own MVP cut (Part 6) tags these CORE-v1, but they have no dependency on the RLS-rewrite spine and can run in parallel with or after Phases 6–7:
- **Per-user preference layer** — revive `user_settings.preferences` (SEED-117 §2), the two-layer allowed-set→preference pattern (SEED-116).
- **Commercial footholds** — `subscription_tier`/`add_ons` columns, the reusable entitlement-check primitive replacing the lying stub (SEED-080), retention/rate-limit data-layer + admin UI (enforcement deferred to v3.5/v3.6).

### STRETCH (research-gated — may slip without breaking the security guarantee)
- **Permission-aware citations** ("only cites what you can access") — gate on a CITE-01 leak threat model + a pgvector+RLS latency/recall benchmark FIRST; also depends on folder-level dept/role sharing (Phase 7-adjacent) landing and stabilizing before it can be built at all.
- OIDC enterprise SSO via a custom Authlib SP.
- Department-targeted skill/automation availability (fold into Phase 5 if skills RLS is already being rewritten there).
- Admin tiers assignable to groups; per-group beta/feature-rollout gating.
- An honest, single-component Pro/Enterprise refusal surface.

### Phase Ordering Rationale

- **Schema-additive → backfill → RLS is forced by data dependency:** you cannot flip `org_id` `NOT NULL` before backfilling, and RLS predicates are meaningless before the column is populated.
- **RLS + client-swap are ONE phase** because RLS alone changes nothing under a service-role or table-owner asyncpg connection — this is the single highest-signal convergence across STACK, ARCHITECTURE, and PITFALLS, reached independently.
- **SECDEF audit + the isolation suite follow the RLS rewrite** because the INVOKER rewrite of `match_document_chunks` needs `document_chunks`'s new `org_id`/RLS to exist first.
- **SSO is last** because it is the only piece with a heavy external IdP dependency and zero downstream dependents; cutting it still ships a usable platform.
- **Org-admin shell follows the data layer** because the UI is meaningless until org isolation is real, and it mostly reuses the shipped v3.3 Control-Room shell as composition, not new patterns.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 3 (RLS+client swap)** — the exact asyncpg `SET LOCAL`/`SET ROLE` semantics need a LIVE two-user leak test before this ships; STACK.md explicitly flags one source's `set_config` third-argument claim as likely lossy (conflating role-bypass with the claims flag). This is the highest-stakes phase in the milestone; do not proceed on documentation alone.
- **Phase 4 / the permission-aware-citations STRETCH** — pgvector+RLS/HNSW combined latency AND ANN-recall behavior is completely unmeasured; Supabase's own docs warn RLS is latency-sensitive but give zero guidance on RLS+ivfflat/hnsw interaction. Needs a benchmark spike before promising the only-cites-what-you-can-access guarantee.
- **Phase 8 (SSO), only if OIDC is pulled into v1 scope** — per-org OIDC is confirmed NOT native to Supabase (HIGH confidence, verified twice against official docs), but the exact `signInWithSSO` reference behavior is flagged for a live re-confirm before committing to the Authlib custom-SP build.
- **The personal-org/JIT creation seam (Phase 2/7 boundary)** — trigger (`handle_new_user`, SQL-only, atomic with signup) vs. app-layer (flexible for SSO attribute mapping) is unresolved; ARCHITECTURE flags this may need BOTH, not a single choice.

Phases with standard patterns (skip research-phase):
- **Phase 0 (ADR)** — pure ratification of an already-evidenced decision.
- **Phase 1 (schema)** — the `SECURITY DEFINER`-helper pattern for breaking RLS recursion is textbook Postgres/Supabase, and this exact codebase already trusts the pattern via `folder_is_globally_visible`.
- **Phase 5 (`is_global` retirement)** — mechanical rename + allow-list, low ambiguity.
- **Phase 6 (org-admin shell)** — reuses the shipped v3.3 Control-Room shell pattern almost entirely as composition.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, the Supabase SAML tier structure, self-hosted GoTrue, and the asyncpg RLS pattern verified against official docs; MEDIUM sub-flag on the per-org-OIDC gap and the exact `set_config`/`is_local` flag semantics (both explicitly flagged for live verification). |
| Features | MEDIUM-HIGH | Glean/Supabase/multi-tenant-canon claims are from vendors' own current docs, fetched 2026-07-18 (HIGH); some Glean agent-governance claims read as marketing copy (MEDIUM); existing-app facts (VIS-01, SEED refs) are HIGH. |
| Architecture | HIGH | Grepped directly against the live `supabase/full-schema.sql` at migration head 103 — every table/function/policy count is real, not inferred from the stale brief. |
| Pitfalls | HIGH (codebase traps) / HIGH (SSO CVE class) / MEDIUM (supabase-py per-request-JWT ergonomics) | Codebase-specific traps verified live against `full-schema.sql`, `dependencies.py`, `sql_service.py`, mig 096; the SSO CVE class is well-documented externally; the per-request-JWT pattern is correct but unbenchmarked in this codebase. |

**Overall confidence:** HIGH — an unusually well-evidenced research base; three of four files grepped the live schema directly rather than trusting the stale brief. The residual uncertainty concentrates exactly where it should: the `SET LOCAL`/`SET ROLE` RLS-context semantics, and pgvector+RLS performance at scale — both are called out below as gates, not blind spots.

### Gaps to Address

- **The exact asyncpg `SET LOCAL`/`SET ROLE` semantics for RLS context are unverified by documentation alone.** STACK.md flags one source's claim (`set_config` third arg `false`) as likely lossy, conflating the role-bypass issue with the claims flag. Must be settled by a live two-user leak test (Phase 3's acceptance gate), not taken on faith.
- **pgvector + RLS performance/recall is completely unmeasured.** No vendor guidance exists for RLS combined with `ivfflat`/`hnsw`. This gates the permission-aware-citations STRETCH and constrains how aggressive the org/folder predicates on `document_chunks` can be without moving the CONCUR-01 gate.
- **Per-org OIDC scope is a product decision, not a research one.** Supabase's per-org enterprise SSO is confirmed SAML-only; whether a customer forces OIDC into v1 (triggering the Authlib SP build) needs an operator call, not more research.
- **Personal-org/JIT provisioning seam ownership is unresolved** — trigger vs. app-layer vs. both; affects the Phase 2/7/8 boundary directly.
- **A genuine inter-researcher divergence, resolved here:** PITFALLS.md's SSO pitfall (#9) recommends pinning `python3-saml` to a current patched release and hardening a raw XML SAML parser — this directly contradicts STACK.md's live-docs-verified finding that **Supabase Auth is the SAML SP**, and that `python3-saml` should be dropped entirely. Resolution for the roadmapper: STACK.md's finding is authoritative (verified same-day against official Supabase docs) — Supabase/GoTrue owns the SAML XML parsing and its own CVE surface, not our app. Pitfall 9's genuinely-surviving risks don't depend on who parses the XML: idempotent JIT provisioning (covered in Phase 7), OIDC discovery SSRF (only relevant if Authlib/OIDC is actually built), and the SSO-enforcement-before-fallback-proven lockout risk (still ours, still real). **Do not budget Phase 8 effort for hardening a SAML XML parser this app no longer owns.**
- **ARCHITECTURE.md and PITFALLS.md order SSO differently** in their phase-role decomposition (Architecture: last, Phase 8; Pitfalls: P5, before org-admin UI and invitations) and Pitfalls treats the full cross-org regression sweep as its own final gate (P8-ISOLATION) distinct from Phase 4's SECDEF-specific two-org tests. This summary adopts Architecture's SSO-last, first-to-cut ordering (the stronger argument — SSO has zero downstream dependents), but the roadmapper should still schedule a **final full-regression pass** (SC#10's 4-axis UAT + CONCUR-01 + the complete two-org suite) as the actual milestone-closing gate, run again after SSO/invitations/org-admin-UI have all landed — not only immediately after Phase 4's SECDEF-scoped tests.
- **Re-verify the live table/stub counts at plan time** — this research greps migration head 103; confirm nothing landed between this research and phase-planning.

## Sources

### Primary (HIGH confidence)
- Supabase Docs — SAML 2.0 for Projects, Enterprise SSO index, self-hosted SAML SSO, Custom Access Token Hook, JWT Signing Keys, RAG with Permissions: https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml , /guides/auth/enterprise-sso , /guides/self-hosting/self-hosted-saml-sso , /guides/auth/auth-hooks/custom-access-token-hook , /guides/auth/signing-keys , /guides/ai/rag-with-permissions
- Supabase Pricing (SAML Pro+, 50 SSO MAUs, $0.015/MAU overage): https://supabase.com/pricing
- Supabase Discussion #30124 — running queries as the authenticated user via a direct connection (`set_config`/role pattern): https://github.com/orgs/supabase/discussions/30124
- Supabase Discussion #33811 + service-role/RLS troubleshooting doc — service-role key ALWAYS bypasses RLS: https://github.com/orgs/supabase/discussions/33811 , https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z
- PostgREST Docs — Authentication (claims via `current_setting`): https://docs.postgrest.org/en/v12/references/auth.html
- Glean official docs (fetched 2026-07-18) — Administrator Roles, Group-based permissions, About the Admin Console, Agent Governance, Citations: https://docs.glean.com/administration/identity/roles/admin-roles , /administration/identity/roles/group-based-permissions , /administration/about
- Multi-tenant RBAC canon — WorkOS, Auth0, Clerk: https://workos.com/blog/how-to-design-multi-tenant-rbac-saas , https://auth0.com/blog/how-to-choose-the-right-authorization-model-for-your-multi-tenant-saas-application/ , https://clerk.com/blog/how-to-design-multitenant-saas-architecture
- Permission-aware RAG — TianPan, Pinecone, Cerbos: https://tianpan.co/blog/2026-05-04-permission-aware-retrieval-enterprise-rag-access-control , https://www.pinecone.io/learn/rag-access-control/ , https://www.cerbos.dev/features-benefits-and-use-cases/access-control-for-rag
- PyPI versions (verified 2026-07-18): `python3-saml` 1.16.0, `resend` 2.34.0, `Authlib` 1.7.2, `boto3` 1.43.51, `PyJWT` 2.13.0, `gotrue` 2.12.4, `supabase` 2.31.0.
- Live-code verification: `supabase/full-schema.sql` @ migration head 103 (tables, 11 `SECURITY DEFINER` functions, 110 policies, 4 Storage buckets); `backend/app/dependencies.py` (service-role singleton, asyncpg pool); `backend/app/services/sql_service.py` (`_inject_user_id` regex); `backend/app/services/retrieval_service.py`; `backend/app/utils/folder_utils.py`; `supabase/migrations/095/096/087`; `backend/tests/integration/test_058_concurrency.py`.
- Internal: `.planning/PROJECT.md` (v3.4 scope cut, ratify-not-relitigate ADR framing), `.planning/PRDs/SEQUENCE.md`, `.planning/prd-reset/DECISIONS.md` (D-PRD-01/02/05/10), SEED-004/080/091/099/113/115/116/117, `CLAUDE.md` (D-v2.5-01/03, D-14, G-5 ledger, WORKER_COUNT=2).

### Secondary (MEDIUM confidence)
- Beam AI marketing + reviews (workspace/team RBAC + HITL governance, thinner than Glean): https://beam.ai/platform , https://beam.ai/agentic-insights/how-to-audit-ai-agents-before-enterprise-security-review
- python3-saml CVE history, cited to justify AVOIDING it (CVE-2017-11427, CVE-2016-1000251) and the recurring XSW class (CVE-2025-47949 samlify, CVE-2026-47201 authentik): https://github.com/SAML-Toolkits/python3-saml , https://security.snyk.io/vuln/SNYK-PYTHON-PYTHON3SAML-40775 , https://portswigger.net/research/the-fragile-lock
- Classic DMS folder-inheritance precedent (SharePoint/Box/Egnyte) — general knowledge, no fetched source.
- Makerkit — Supabase RLS best practices for multi-tenant apps: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices

### Tertiary (LOW confidence)
- None flagged as LOW — the two candidate LOW-confidence claims in the source files (a PostgREST excerpt on `set_config` transaction internals, and one paraphrased community claim on the `is_local` flag) were promoted to explicit MEDIUM/flagged-for-verification gates rather than silently trusted; see Gaps above.

---
*Research completed: 2026-07-18*
*Ready for roadmap: yes*
