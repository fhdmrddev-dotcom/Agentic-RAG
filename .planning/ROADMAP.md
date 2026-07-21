# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1-8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9-17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18-25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26-32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33-43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44-57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058-067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068-082 (shipped 2026-05-27)
- ✅ **v2.7 Agent Workspace & Panel** — Phases 083-088 (shipped 2026-05-30)
- ✅ **v2.8 Harness Engine & Workflow Mode** — Phases 089-096 (shipped 2026-06-07)
- ✅ **v2.9 Workflow Studio** — Phases 097-104 CORE (shipped 2026-06-15); STRETCH 105-109 deferred
- ✅ **v3.0 Document Management** — Phases 110-119 (shipped 2026-06-21). SEED-005 Tier A as a first-class product surface: DM Foundations → metadata enrichment + multi-provider embeddings → metadata-driven views / "virtual folders" → document relationships → auto-classification → governance health. 24/24 functional requirements delivered.
- ✅ **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers** — Phases 120-129 (CORE 120-124+123.1; STRETCH 127-129 shipped; 125/126/130/131 deferred) (shipped 2026-06-28). Collision fix + context isolation · cross-provider trust/honesty parity · Skill Trigger Tuner · Workflow Studio soul + strict↔loose · chat tool-card unification + provider logos · MiniMax/OpenRouter arg repair.
- ✅ **v3.2 Skill Eval Studio + Self-Improving** — Phases 132-145 (CORE 132-137 + inserts 134.1/137.1/137.2; STRETCH 138-143+145 shipped; 144/FILE-01 deferred → v3.3) (shipped 2026-07-10). Skill Eval Studio (eval persistence + versions + with-vs-without runner + honest verdicts + ratings + self-improve loop + publish gate + Evals panel) · built-in skill-creator · STRETCH honesty phases · run-lifecycle foundation (FND-01) · Starter Workflow Library (WF-01).
- ✅ **v3.3 Operator UX** — Phases 146-159 (shipped 2026-07-18). Operator/admin tier (gated /admin Control Room + governance) + dynamic model-registry/discovery + secrets-at-rest + workflow/agent file-inputs + inline citations + plain-language + WCAG-AA + deployment presets/install wizard. 20/20 requirements delivered.
- 🚧 **v3.4 Multi-Tenancy & Org Access** — Phases 160-173 (CORE 160-168 + STRETCH 169-173; started 2026-07-18). The load-bearing **one-way RLS door**: membership-based tenancy (Tenancy ADR → org/dept/role schema → personal-org backfill → the atomic RLS + user-JWT-client-swap crux → SECDEF audit + two-org isolation suite → `is_global` retirement → org-admin shell/switcher → invitations/roles/greenlists → SAML SSO) plus its governance/identity projection. Migrations continue from live head → **slot 104+**. **Authoritative map: `PRDs/SEQUENCE.md`.**
- 📋 **v3.5 Open Platform (API/MCP)** → **v3.6 Automations** — the enterprise-GTM track continues after v3.4 (SEED-013/014 connectors, SEED-117 §1/§3 config-consolidation deferred here). **Authoritative map: `PRDs/SEQUENCE.md`.**

---

## v3.4 Multi-Tenancy & Org Access — 🚧 ACTIVE (started 2026-07-18)

**Started:** 2026-07-18 (research-first; scope + CORE/STRETCH split operator-approved). Numbering continues from v3.3's last phase (159) → **CORE Phases 160-168**, then **STRETCH Phases 169-173** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 precedent). Migrations continue from live head → **next free slot = 104**.

**Goal:** Turn Agentic RAG from a per-user application into an org-aware multi-tenant platform — the load-bearing **one-way RLS door** that unlocks the hybrid SaaS posture (D-PRD-02): co-tenant (`org_id` + membership RLS) by default, isolation-via-deployment for enterprise.

**The crux (research's single highest-signal convergence):** today RLS is *decorative* — the backend runs on a service-role singleton that unconditionally bypasses it; the real per-user boundary is ~253 hand-written `.eq("user_id")` filters across 32 files. So the RLS predicate rewrite (TEN-01) is **inert** unless the per-request user-JWT client swap (TEN-02) + the `document_chunks`/`skill_embeddings` perf denormalize (TEN-04) land in the **SAME atomic phase (163)**. Never "policies now, client later." `SET LOCAL ROLE authenticated` (not just the JWT claims) is what actually turns RLS on against the table-owner asyncpg DSN.

**Red line (every phase):** Deep Mode stays byte-identical; provider differences stay at the gateway/adapter boundary; no new runtime (D-14). The ~253 `.eq("user_id")` filters become **belt-and-suspenders** under the new user-JWT client — **KEEP them this milestone** (do not delete prematurely; a later hardening pass owns their removal).

**Scope source:** `.planning/REQUIREMENTS.md` (22 CORE + 7 STRETCH). Research base: `.planning/research/SUMMARY.md` (re-authored against live schema head 103 — 38 user-facing tables, 4 SECDEF retrieval/sharing functions, Supabase-native SAML). Milestone framing: `.planning/PROJECT.md` → Current Milestone. Migration head at research time: 103 (re-verify at plan time per SUMMARY Gaps).

### Phase Table (CORE — Phases 160-168)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 160 | Tenancy-Model ADR | Ratify the co-tenant + isolation-via-deployment posture + the 4-tier deployment-flexibility contract; lock the naming/renumbering decisions | ADR-01 | 4 | ratify-not-relitigate; **no code**; **deployment-flexibility guarantee (non-negotiable)**; no threat model; skip research-phase |
| 161 | Org / Dept / Role Schema | Ship the org/dept/role/membership schema with RLS + the recursion-safe helper from day one | ORG-01, ORG-02 | 4 | **threat model** (isolation cluster — RLS-from-day-one; `current_user_org_ids()` breaks 42P17 recursion); additive / zero-behavior-change; skip research-phase |
| 162 | Personal-Org Backfill | Silently give every existing user a personal org + backfill `org_id` everywhere — nothing breaks | MIG-01 | 4 | **threat model** (isolation cluster — lock-storm / idempotency / NOT-NULL-ordering / `is_global` data-loss); no UI |
| 162.5 | threads.py Producer Extraction (G-5 refactor) | Extract the inline producer / finalize / kickoff / title / model-resolution out of the 2,444-LOC `threads.py` into 4 service modules, proving Deep byte-identical — the D-01 hard gate before the crux | — (enables TEN-02) | 4 | **G-5/G-1 paydown** (promoted from 163 Wave 0 at plan-time — operator-approved 2026-07-19); Deep byte-identical gate (Phase-089 harness); no org/RLS content; no new threat surface; skip research-phase |
| 163 | RLS Rewrite + User-JWT Client Swap — **THE ATOMIC CRUX** | Land membership RLS + the per-request user-JWT client TOGETHER so RLS is actually enforced | TEN-01, TEN-02, TEN-04 | 5 | **SC#10**; **threat model (the security core)**; **G-5/G-1** (`threads.py` extraction promoted to **Phase 162.5** — MUST land byte-identical before this phase); **perf gate** (CONCUR-01 <1s); **research-phase** (live two-user `SET LOCAL`/`SET ROLE` leak test — do NOT ship on docs alone) |
| 164 | SECDEF Audit + Cross-Org Isolation Suite | Scope the 4 SECDEF functions + prove zero cross-org leakage with a two-org test suite | TEN-03, TEN-05, TEN-06, PRAG-01 | 4 | **SC#10** (retrieval path); **threat model (security core)**; **research-phase** (pgvector+RLS latency/recall unmeasured); folds SEED-091 |
| 165 | `is_global` Retirement Cleanup | Retire `is_global` → `is_org_shared` everywhere + a migration-only `is_system_global` allow-list | MIG-02 | 3 | threat model (lighter — `is_system_global` is cross-org visibility, must stay migration-only); mechanical; skip research-phase |
| 166 | Org-Admin Shell + Switcher + Profile + Audit + Settings Split | Ship the org-admin shell + org switcher + profile anchor + org-scoped audit + Settings IA split | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05 | 5 | **SC#10** (UI state / stream teardown); **G-2 sketch** (SEED-113 identity anchor); **G-5** (`StreamsProvider.tsx` — `<OrgContext>` wraps OUTSIDE it, keep 067.5 Branch-D3 clear guard); threat model (X-Org-Id server-validate + audit authz); UI hint; reuses v3.3 Control-Room shell |
| 167 | Invitations + Roles + Greenlists + JIT + Per-User Prefs | Invitations + role/group greenlists + idempotent JIT + the revived per-user preference layer | INV-01, INV-02, VIS-01, VIS-02 | 4 | **SC#10** (VIS-02 model-default = provider routing; greenlist = UI state); **threat model** (invitation token/expiry + JIT advisory-lock race); **G-2 sketch** (greenlist/roster UI if visual); UI hint |
| 168 | SSO — SAML 2.0 (CORE) | Native SAML 2.0 SSO + JIT + email-domain routing; password fallback retained | SSO-01 | 3 | **threat model** (SSO — but Supabase/GoTrue owns the SAML XML parse, so NOT hardening a parser; surviving risk = enforcement-before-fallback); UI hint (SSO tab); **0 new hard deps** (`python3-saml` dropped) |

### Phase Table (STRETCH — Phases 169-173, gated behind CORE)

Ship only if CORE lands clean and budget remains. First-to-cut ordering: SSO/OIDC + citations are the natural cuts (zero downstream dependents / research-gated).

| Phase | Name | Requirements | SC# | Depends / Flags |
|-------|------|--------------|-----|-----------------|
| 169 | Dept-Admin Shell | ADMIN-06 | 2 | 166 + 167; **G-2 sketch**; UI hint; scoped-down composition of the org-admin shell |
| 170 | Commercial Footholds — Entitlements + Retention/Rate-Limit Data Layer | ENT-01, ENT-02 | 2 | 161 + 166; UI hint; **footholds only** (no sweeper / token-bucket enforcement, no billing) |
| 171 | Permission-Aware Citations | PRAG-02 | 2 | 164 + 167; **research-gated** (CITE-01 leak threat model + pgvector+RLS latency/recall bench FIRST); **SC#10**; **G-5** (`retrieval_service.py` + citation renderer); UI hint |
| 172 | OIDC Enterprise SSO | SSO-02 | 2 | 168; **threat model** (OIDC discovery SSRF); `Authlib` (scope-gated dep — the one org-SSO protocol Supabase lacks); UI hint; **customer-triggered** |
| 173 | Dept-Targeted Skills + Group Feature-Rollout Gating | VIS-03, VIS-04 | 2 | 165 + 167; UI hint; folds into the rewritten skills RLS + the VIS-01 greenlist resolver |

### Phase Checklist

- [x] **Phase 160: Tenancy-Model ADR** — ratify D-PRD-02 co-tenant posture + lock `is_system`→`is_system_global` reuse + 104+ renumbering (ADR-01)
- [x] **Phase 161: Org / Dept / Role Schema** — 8 org tables + `current_user_org_ids()` helper + non-recursive `org_members` policy + nullable `org_id` on the ~26 remaining tables, RLS from day one (ORG-01, ORG-02)
- [x] **Phase 162: Personal-Org Backfill** — one personal org + default dept + org-admin membership per user; batched idempotent `org_id` backfill; org_id auto-fill net (mig 106) so nothing breaks; NOT-NULL only after zero-NULL (MIG-01)
- [x] **Phase 162.5: threads.py Producer Extraction (G-5 refactor)** — extract `agent_runner`+`_shielded_finalize`+`spawn_continuation_run` → `run_producer.py` (8 finalize invariants preserved) + `workflow_kickoff.py`/`thread_title.py`/`run_model_resolution.py`; Deep byte-identical + full suite green = the hard gate before 163 (enables TEN-02) — **operator-approved 2026-07-19 (D-A6 gate PASSED; Phase 163 unblocked)**
- [x] **Phase 163: RLS Rewrite + User-JWT Client Swap — THE ATOMIC CRUX** — (after Phase 162.5 extraction) membership RLS across 38 tables + user-JWT client on BOTH paths (supabase-py JWT-header + asyncpg `SET LOCAL ROLE authenticated`) + `document_chunks`/`skill_embeddings` `org_id` denormalize+index (TEN-01, TEN-02, TEN-04) — **COMPLETE 2026-07-20**: 11/11 plans, migs 107+108 + FIX-A mig 109 (platform-universal RLS); UAT 8/8, secure-phase 28/28 STRIDE (threats_open:0); membership RLS now the ENFORCED gate on every request path
- [x] **Phase 164: SECDEF Audit + Cross-Org Isolation Suite** — 4 SECDEF functions org-scoped + `search_path` pinned + `_inject_user_id` deleted; `test_v3_4_org_isolation.py` two-org exit gate; folder-ACL retrieval isolation; SEED-091 closed (TEN-03, TEN-05, TEN-06, PRAG-01) — **COMPLETE 2026-07-20**: 5/5 plans, mig 110 (4 SECDEF org-scoped + `search_path=''` + producer→asyncpg user-context swap); exit gate 22 passed / 1 xfailed; UAT 2/2 (SC#10 + null-owner UI); secure-phase SECURED (threats_open:0); CR-01/WR-01 folded → Phase 165
- [x] **Phase 165: `is_global` Retirement Cleanup** — `is_global`→`is_org_shared` rename across SQL / `folder_utils.py` / Storage policy + UI copy; migration-only `is_system_global` allow-list for the seeded skill-creator (MIG-02) — **COMPLETE 2026-07-21**: 12/12 plans (11 + gap-closure 12), mig 111 (D-165-01 semantic split, value-preserving RENAME ×6) applied live + catalog-verified (no over-widening, write-lock intact); SEED-124 folder leak CLOSED (SC#4 exit gate `test_v3_4_org_isolation.py` 23 passed); verify 7/7 PASS. Findings: SEED-125 planted (skills-domain sibling leak, pre-existing); 2 `test_163_rls_*` FIX-A-universality tests deferred (pre-existing)
- [ ] **Phase 166: Org-Admin Shell + Switcher + Profile + Audit + Settings Split** — profile identity anchor + org switcher (`<OrgContext>` outside StreamsProvider) + 7-tab org-admin shell + org-scoped audit + SEED-116 Settings IA split (ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05)
- [ ] **Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs** — email/link invitations + adoption states on the 148 roster + role/group greenlists (VIS-01 resolver) + idempotent JIT + revived `user_settings.preferences` (INV-01, INV-02, VIS-01, VIS-02)
- [ ] **Phase 168: SSO — SAML 2.0 (CORE)** — Supabase-native SAML 2.0 SP + domain routing + attribute→dept mapping + JIT (167 seam); email/password fallback retained (SSO-01)
- [ ] **Phase 169 (STRETCH): Dept-Admin Shell** — narrower `dept:manage` shell (Dept Members / Skills / Retention / Audit) (ADMIN-06)
- [ ] **Phase 170 (STRETCH): Commercial Footholds** — `require_tier()` / `require_add_on()` replacing the lying stub + retention/rate-limit data layer + org-admin UI (ENT-01, ENT-02)
- [ ] **Phase 171 (STRETCH): Permission-Aware Citations** — research-gated; an answer never cites/previews a doc the asking user can't open (PRAG-02)
- [ ] **Phase 172 (STRETCH): OIDC Enterprise SSO** — per-org OIDC via a custom Authlib SP (customer-triggered) (SSO-02)
- [ ] **Phase 173 (STRETCH): Dept-Targeted Skills + Group Feature-Rollout Gating** — dept-scoped skill availability + admin-tier/beta group gating (VIS-03, VIS-04)

### Phase Details

#### Phase 160: Tenancy-Model ADR
**Goal**: A written Tenancy-Model ADR ratifies the co-tenant-default + isolation-via-deployment posture and locks the naming/renumbering decisions, so every downstream phase builds on a settled, non-relitigated foundation.
**Depends on**: Nothing (first phase)
**Requirements**: ADR-01
**Success Criteria** (what must be TRUE):
  1. A written ADR exists ratifying D-PRD-02 (co-tenant `org_id` + membership RLS by default; isolation-via-deployment for enterprise) — a reader can see the tenancy posture is settled, not re-opened.
  2. The ADR locks the `skills.is_system` → `is_system_global` reuse and the 104+ migration renumbering as binding for phases 161-168.
  3. The ADR records that v3.3's shipped `org_id` stubs + Solo/Team/Enterprise deploy presets already ~80% pre-decided this posture (ratify-not-relitigate scope) — no code changes in this phase.
  4. The ADR ratifies the **4-tier deployment-flexibility contract — binding and non-negotiable for the milestone**: **solo-local**, **small-team-VPS**, **medium-SaaS (co-tenant)**, and **enterprise / on-prem / BYO (isolation-via-deployment, customer-owned Supabase)** all remain a **pure env-var switch** with no hardcoded URLs / keys / models / ports; the **local setup never breaks**; the co-tenant vs isolated choice is a deploy-time decision, never a code fork; and the org-settings + encrypted-secrets substrate stays **forward-compatible with per-org provider config / BYO keys / per-org (incl. local) model selection** ([[SEED-120]]) so v3.5 adds them with **no schema rewrite**. Every subsequent v3.4 phase is verified against this contract (nothing may make a deployment tier harder).
**Plans**: 1 plan
- [x] 160-01-PLAN.md — Write the Tenancy-Model ADR (ratify D-PRD-02 + lock `is_system_global`/`is_org_shared`/slot-104+ + the 4-tier deploy-flexibility contract) and record it as D-v3.4-01 in DECISIONS.md + PROJECT.md

#### Phase 161: Org / Dept / Role Schema
**Goal**: The org/dept/role/membership schema exists with RLS from day one and the recursion-safe membership helper, so backfill and the RLS rewrite have something to reference — with zero behavior change on creation.
**Depends on**: Phase 160
**Requirements**: ORG-01, ORG-02
**Success Criteria** (what must be TRUE):
  1. The 8 org tables ship — `organizations` (incl. `subscription_tier` + `add_ons jsonb`), `departments` (nullable `parent_id` self-FK + one auto-created default department per org), `org_members`, `dept_members`, `roles` + `role_permissions` (fixed 4-tier enum: super-admin / org-admin / dept-admin / member), `org_invitations`, `sso_configs` — all with RLS, FKs, and indexes from creation.
  2. A `current_user_org_ids()` `SECURITY DEFINER` helper + a non-recursive self-rows-only `org_members` policy exist, and a live authenticated query against `org_members` does NOT raise `42P17`; every other table's membership predicate calls the helper (never inlines an `org_members` subquery).
  3. Nullable `org_id` is present on every user-facing table still lacking it (the ~26 tables beyond the 12 already stubbed), added additively so existing behavior stays byte-identical.
  4. A 5-person team and a 2,000-person org are served by the SAME schema — small orgs never touch `dept_members`; large orgs nest via `departments.parent_id` — with no schema change either way.
**Plans**: 2 plans (Wave 1 authoring → Wave 2 apply/verify)
- [x] 161-01-PLAN.md — Author migration 104: 8 org tables + 3 SECDEF helpers (current_user_org_ids/current_user_has_permission/create_org_with_default_dept) + membership RLS + permission-catalog seed + the 23-table org_id sweep (Wave 1, autonomous)
- [x] 161-02-PLAN.md — [BLOCKING] Operator SQL-editor apply + full-schema regeneration + live 42P17/RLS/seed verification + same-commit (Wave 2, autonomous:false)

#### Phase 162: Personal-Org Backfill
**Goal**: Every existing user silently gets a personal org + default department + org-admin membership and `org_id` is backfilled across every table, so the RLS rewrite can go live without any user action and with zero data loss.
**Depends on**: Phase 161
**Requirements**: MIG-01
**Success Criteria** (what must be TRUE):
  1. After the migration, every existing user owns exactly one personal org with a default department and an org-admin membership — no duplicates on a re-run (idempotent on `WHERE org_id IS NULL`).
  2. `org_id` is backfilled non-NULL across every user-facing table (batched ~10k-row windows; owner-less child tables resolved through their parent FK), and the `NOT NULL` flip happens only after a verified zero-NULL check.
  3. All existing data is preserved and every previously-visible resource stays visible — no user has to do anything, and nothing they could see before disappears.
  4. Re-running the migration (a normal SQL-editor-paste recovery action) neither lock-storms production nor duplicates orgs/memberships.
**Plans**: 3 plans
- [x] 162-01-PLAN.md — Author migration 105: personal-org provisioning + defensive handle_new_user trigger + batched org_id backfill (35 targets) + self-guarded NOT-NULL flips
- [x] 162-02-PLAN.md — Apply migration 105 (non-atomic) + prove SC#1–4 + idempotent re-paste + regenerate full-schema.sql + same-commit
- [x] 162-03-PLAN.md — [gap-closure] Author + apply migration 106: BEFORE-INSERT org_id auto-fill net across the 35 backfilled tables — closes the 162→163 insert-break seam so the "nothing breaks" goal holds while org_id stays NOT NULL; regenerate full-schema + same-commit

#### Phase 162.5: threads.py Producer Extraction
**Goal**: Extract the inline producer-shell / finalize / workflow-kickoff / title / model-resolution logic out of the 2,444-LOC `threads.py` into 4 cohesive service modules, proving **Deep-Mode byte-identical + full test suite green** — the D-01 hard gate that pays down the overdue G-5 `threads.py` extraction BEFORE any `org_id` / RLS / client-swap work touches `send_message` in Phase 163. Promoted from 163 Wave 0 at plan-time (operator-approved 2026-07-19) — measured ~1,100–1,400 LOC / 4 modules with 8 byte-identical finalize invariants, a distinct acceptance bar from the security crux.
**Depends on**: Phase 162 (numerically prior — no data dependency; pure refactor). **Blocks Phase 163** — the crux MUST NOT start until this phase's Deep-byte-identical verify-work passes.
**Requirements**: none — pure G-5 refactor (no own REQ-ID; **enables TEN-02** by giving the client swap a clean producer seam; mirrors the v3.2 FND-01 `threads.py` extraction precedent).
**Success Criteria** (what must be TRUE):
  1. The `agent_runner` producer + `_shielded_finalize` (`threads.py:1410-2003`) are extracted into `run_producer.py` and UNIFIED with the near-duplicate `spawn_continuation_run` (`:2279-2444`), preserving all 8 finalize-ordering invariants (shielded persist → system_warnings → RUN-01b gate → `finalize_run_terminal` atomic co-write → terminal sentinel XADD after-finalize / before-EXPIRE → EXPIRE → harness terminalize → `RUN_TASKS.pop`).
  2. `workflow_kickoff.py`, `thread_title.py`, and `run_model_resolution.py` extract the kickoff-preflight, title, and model/provider-resolution logic; `threads.py` shrinks with no behavior change.
  3. **Deep-Mode byte-identical** on the native-7 (the Phase-089 harness + full integration suite green); no provider-path or SSE-vocabulary change.
  4. Zero `org_id` / RLS / client-swap content (pure refactor; no new threat surface).
**Plans**: 4 plans (sequential — file-ownership on threads.py forces serialization; order = leaves → kickoff → producer → BLOCKING gate)
- [x] 162.5-01-PLAN.md — Leaf extractions: thread_title.py (title subsystem + auto-title emit) + run_model_resolution.py (disabled-model fallback + provider resolution)
- [x] 162.5-02-PLAN.md — workflow_kickoff.py: _ensure_skill_snapshots + kickoff-preflight + harness run-context/scope build
- [x] 162.5-03-PLAN.md — run_producer.py: agent_runner + _shielded_finalize UNIFIED with spawn_continuation_run over one shared finalizer (8 invariants preserved)
- [x] 162.5-04-PLAN.md — [BLOCKING] Deep byte-identical gate (Phase-089 harness + full live suite + native-provider 4-axis smoke; autonomous:false)

#### Phase 163: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX
**Goal**: Membership-based RLS and the per-request user-JWT DB context land TOGETHER across both data-access paths, so RLS becomes actually enforceable (not decorative) — the single load-bearing security transition of the milestone — with the `threads.py` producer extraction landed as **Phase 162.5** (proven Deep-byte-identical) FIRST and retrieval performance held under the CONCUR-01 gate.
**Depends on**: Phase 162 (`org_id` populated) + **Phase 162.5** (the `threads.py` producer extraction — MUST be verify-work'd Deep-byte-identical FIRST). **G-5/G-1: no `org_id` touches `send_message` until 162.5 lands.**
**Requirements**: TEN-01, TEN-02, TEN-04
**Success Criteria** (what must be TRUE):
  1. Every RLS predicate on all 38 user-facing tables is membership-based (`org_id = ANY(current_user_org_ids()) AND (owner-within-org OR is_org_shared OR dept-scoped OR is_system_global)`), shipped across reviewable per-cluster bundles (documents / chat / skills / DM / workflow-eval / identity-audit).
  2. Hot paths run on a per-request user-JWT client on BOTH data-access paths — supabase-py (JWT-header swap) and the raw asyncpg pool (`SET LOCAL request.jwt.claims` + the mandatory `SET LOCAL ROLE authenticated`) — and a live two-user leak test proves user B cannot read user A's rows (RLS is now enforced, not bypassed by the service-role / table-owner connection).
  3. `get_service_role_supabase(org_id)` refuses to construct without an explicit org and is retained only for legitimate cross-tenant ops (SSO JIT, org-admin cross-member reads, the fully-async agent/eval/harness/re-embed writes whose `.eq("user_id")` filters widen to org-aware); the `.eq("user_id")` filters are KEPT as belt-and-suspenders (not deleted this milestone).
  4. `org_id` is denormalized + partial/composite-indexed on `document_chunks` and `skill_embeddings` alongside the vector index, and a benchmark shows membership-RLS retrieval keeps the CONCUR-01 <1s cross-tab-GET-during-streaming gate GREEN (measured before merge).
  5. Deep Mode stays byte-identical on the native-7 (SC#10 — no shared-path fork; org context rides the request seam, not the provider path); the `threads.py` producer extraction (Phase 162.5) landed byte-identical BEFORE `org_id` is threaded through `send_message`.
**Plans**: 10 plans, 5 waves (Wave 1 foundation → Wave 2 authoring → Wave 3 apply gate → Wave 4 flip → Wave 5 crux gate)
- [x] 163-01-PLAN.md — Front B factories (get_user_pg_connection / get_user_supabase / get_service_role_supabase) + two-user/two-org fixtures + shared RLS harness (Wave 1)
- [x] 163-02-PLAN.md — TEN-04 migration 107: org_id denormalize + backfill + btree + autofill on document_chunks/skill_embeddings (Wave 2)
- [x] 163-03-PLAN.md — TEN-01 migration 108: 37-table membership-RLS rewrite in 6 per-cluster bundles + 6 cluster tests (Wave 2)
- [x] 163-04-PLAN.md — D-08 core leak (asyncpg + supabase-py) + role-swap-noop / spoof / fail-closed tests (Wave 2)
- [x] 163-05-PLAN.md — [BLOCKING] operator SQL-editor apply 107→108 + regenerate full-schema + live-DB assert + test_163_* suite GREEN (Wave 3)
- [x] 163-06-PLAN.md — Chat/streaming client swap (threads.py-centric, both DB paths) + agent-loop writer widen (Wave 4)
- [x] 163-07-PLAN.md — Documents/DM cluster client swap (retrieval RPCs left to Phase 164) (Wave 4)
- [x] 163-08-PLAN.md — Skills + workflow-eval + identity/settings/audit router client swap (Wave 4)
- [x] 163-09-PLAN.md — Widen eval-runner / harness / re-embed async writers to org-aware service-role (D-05) (Wave 4)
- [x] 163-10-PLAN.md — [BLOCKING] CONCUR-01 <1s benchmark + operator-run D-08 live two-user leak test + SC#10 4-axis UAT (Wave 5)

#### Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite
**Goal**: The four `SECURITY DEFINER` retrieval/sharing functions carry an in-body org predicate + pinned `search_path`, the fragile regex is deleted, and a two-org adversarial test suite proves zero cross-org leakage — the milestone's verifiable isolation gate.
**Depends on**: Phase 163 (needs `document_chunks` `org_id`/RLS live for the INVOKER-caller rewrite)
**Requirements**: TEN-03, TEN-05, TEN-06, PRAG-01
**Success Criteria** (what must be TRUE):
  1. All four DEFINER functions (`match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible` → `folder_is_org_shared`) carry an explicit org predicate in-body + a pinned `search_path`; `_inject_user_id` is DELETED (not extended to `org_id`) and `query_user_documents` is called through the user-JWT client.
  2. `test_v3_4_org_isolation.py` passes and is the milestone exit gate: two seeded orgs × every user-facing table × all four DEFINER functions (0 cross-org rows) × both DB access paths × `X-Org-Id` header-spoof rejection.
  3. Hybrid search returns only rows the asking user may access — org- AND folder-ACL-isolated (`document_chunks` RLS mirrors the full folder-visibility predicate authored in 163) — proven with a live two-user retrieval test (PRAG-01).
  4. Global / org-shared resources (folders / skills / views) null the seeding owner's `user_id` (+ scope UUIDs) for non-owner readers in every list/serialize path (SEED-091 / TEN-06 closed).
**Plans**: 4 plans (3 waves)
- [x] 164-01-PLAN.md — Author the two-org exit-gate suite test_v3_4_org_isolation.py (pg_proc audit helper + red-anchor RED vs pre-164 + table matrix both paths + 4 DEFINER legs + X-Org-Id spoof + PRAG-01 leg) (Wave 1)
- [x] 164-02-PLAN.md — SEED-091 owner-identity nulling across folders/skills/views serialize paths + model loosens + unit test (TEN-06) (Wave 1)
- [x] 164-03-PLAN.md — Author + [BLOCKING] apply migration 110 (4 DEFINER org predicate + pinned search_path + document_chunks PRAG-01 RLS widening) + regenerate full-schema + CONCUR-01 <1s gate (Wave 2)
- [x] 164-04-PLAN.md — Producer client-swap: retrieval RPCs + text-to-SQL/grep onto the asyncpg user-context; delete _inject_user_id/_inject_user_id_for_grep; whole suite GREEN (Wave 3)

#### Phase 165: `is_global` Retirement Cleanup
**Goal**: The `is_global` mechanism is fully retired to `is_org_shared` across code, UI copy, and storage policies, with a migration-only `is_system_global` allow-list keeping the seeded skill-creator cross-org visible — no cross-org leak, no per-org skill-creator copies.
**Depends on**: Phase 164 (mechanical; can overlap — sequenced after the isolation gate)
**Requirements**: MIG-02
**Success Criteria** (what must be TRUE):
  1. `is_global` is value-preservingly RENAMEd to `is_org_shared` (never drop+add) everywhere it lives — SQL columns, the `folder_utils.py` recursive-visibility mirror, and the Storage `skill-files` bucket policy branch.
  2. User-facing copy reads "Shared with org" (not "Global"), and no previously-shared folder / skill / view silently un-shares.
  3. An `is_system_global` allow-list — reusing the write-locked `skills.is_system` marker — keeps the seeded `skill-creator` visible across every org, and no route can set `is_system_global` (migration-only, never route-settable).
  4. **(Folded from Phase 164 CR-01 / [[SEED-124]] — MUST close here)** The `folder_utils.py` visibility helpers (`is_in_global_subtree` / `fetch_visible_folders` / `get_globally_visible_folder_ids`) are **org-scoped** so the agent's service-role KB browse/read tools (`ls`/`tree`/`read_document`/`fetch_document_file`) can no longer enumerate or read documents in another org's `is_org_shared` (formerly `is_global`) folders. Verified by flipping the `xfail(strict=True)` marker `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` in `test_v3_4_org_isolation.py` to XPASS → then removing it. Also close WR-01 (null the seeder's `user_id` on non-`is_org_shared` **descendants** of shared folders in the folders list/serialize path).
**Plans**: 11 plans (Wave 1: 01-09 parallel authoring · Wave 2: 10 operator apply · Wave 3: 11 exit-gate)
- [x] 165-01-PLAN.md — Migration 111: value-preserving `is_global` rename (D-165-01 split) + RLS auto-propagation + DEFINER/trigger rewrites + `folder_is_globally_visible`->`folder_is_org_shared` + storage skill-files policy reconciliation
- [x] 165-02-PLAN.md — Folded SEED-124 fix: org-scope the service-role folder-visibility helpers (CR-01, fail-closed) + subtree-descendant owner-nulling (WR-01) + `is_org_shared` rename in `folder_utils.py`/`kb.py`/`tool_dispatcher.py`
- [x] 165-03-PLAN.md — Backend model + API-layer rename (6 models + 8 routes; platform write-lock preserved)
- [x] 165-04-PLAN.md — Backend service + db rename + isolated `main.py` seed task (15 workflows stay `is_system_global=true`) + D-14 token-only check on agent_loop/openai_service
- [x] 165-05-PLAN.md — Backend tests: RLS/isolation/leak/owner-nulling (15 files, explicit per-table mapping — the mig-109 Test-7 regression-class guard)
- [x] 165-06-PLAN.md — Backend tests: skills/folders domain (19 files -> `is_org_shared`, single-target)
- [x] 165-07-PLAN.md — Backend tests: platform tables workflows/views/rules/metadata (25 files -> `is_system_global`; folders exceptions flagged)
- [x] 165-08-PLAN.md — Frontend components + contract + UI copy ("Global"->"Shared with org", D-165-07); functional isOrgShared vs display isSystemGlobal per file; tsc clean
- [x] 165-09-PLAN.md — Frontend test rename (unrelated isGlobal in ChatHistoryColumn/threadGroups left intact); vitest clean vs rot baseline
- [x] 165-10-PLAN.md — [BLOCKING] Operator applies migration 111 via SQL editor (dev-server stop window) + regenerate full-schema (no-reset) + same-commit + post-apply over-widening check
- [x] 165-11-PLAN.md — Exit-gate re-green + SC#4 arbitration: flip SEED-124 leak test xfail->XPASS->remove marker; two-org suite green (23 passed); backend rename-regression sweep

#### Phase 166: Org-Admin Shell + Org Switcher + Profile-Menu Anchor
**Goal**: A multi-org user gets a real identity anchor, an org switcher that safely swaps active-org context, and an org-admin shell with org-scoped audit + a resolved Settings IA — the human-facing surface of the now-real tenancy model, reusing the shipped v3.3 Control-Room shell as composition.
**Depends on**: Phase 164 (meaningless before org isolation is real)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. A profile-menu identity anchor shows name / email / role badge / sign-out (the user-side counterpart to the Phase-146 operator shield; SEED-113).
  2. A multi-org user sees an org switcher; switching changes active-org context for all subsequent calls via the hybrid mechanism (membership set in the JWT for RLS + a server-validated `X-Org-Id` header), `<OrgContext>` wraps OUTSIDE `StreamsProvider`, and an org switch tears down in-flight subscriptions + refetches (Realtime is best-effort, never the isolation boundary).
  3. An org-admin (with `org:manage`) sees the 7-tab shell (Members/Invitations · Departments/Roles · SSO · Audit · Subscription · Retention · Settings); a non-admin does not.
  4. An org-admin with `org:audit_view` sees all members' audit rows within their org; a member sees only their own (ADMIN-04).
  5. The Settings IA split resolves SEED-116 — personal preferences under the profile menu, org config behind `org:manage`, platform config stays in the Control Room (ADMIN-05).
**Plans**: 5 plans (planned 2026-07-21) — NO new migration (mig 104 `current_user_has_permission()` substrate is sufficient; D-166-09 enforcement is net-new app code)
- [ ] 166-01-PLAN.md — Backend authz + org router (get_active_org_id X-Org-Id validation · require_org_manage · /org/me · /org/memberships · /org/members · /org/audit service-role+app-authz) [Wave 1]
- [ ] 166-02-PLAN.md — Frontend org context + probe + API client (OrgProvider outside StreamsProvider · useOrgPermissionsProbe · X-Org-Id injection · 067.5 switchOrg teardown reuse) [Wave 1]
- [ ] 166-03-PLAN.md — Org tab leaves (OrgBand indigo · OrgMembersTab read-only · OrgAuditTab lighter+RLS-honest degrade · OrgSettingsTab light org-config home) [Wave 2]
- [ ] 166-04-PLAN.md — OrgAdminShell composition (3 live + 4 LockedTab tabs · lazy per-tab fetch · scope-threaded audit degrade) [Wave 3]
- [ ] 166-05-PLAN.md — Identity anchor + reachability (079-C ProfileMenu · indigo Shield-mirror · ChatLayout org-admin mount) [Wave 4]
**UI hint**: yes

#### Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs
**Goal**: An org-admin can invite and onboard members with role/group-based feature greenlists, concurrent first-logins converge to one membership idempotently, and users pick their own defaults within the org-allowed set — the governance + onboarding projection of the tenancy model.
**Depends on**: Phase 161 (org/role schema) + Phase 166 (org-admin shell UI home)
**Requirements**: INV-01, INV-02, VIS-01, VIS-02
**Success Criteria** (what must be TRUE):
  1. An org-admin sends email + link invitations (`org_invitations`, hashed token, expiry, `resend` / SES / `none`-log env-switched provider); a recipient accepts via sign-in or sign-up; adoption states (not-yet-invited / pending / active) render on the Phase-148 roster.
  2. A concurrent first-login (signup / SSO-callback) creates the `org_members` row idempotently (`INSERT … ON CONFLICT DO NOTHING` + advisory lock) so it converges to exactly one membership (INV-02).
  3. Feature visibility resolves per-feature role/group greenlists through the SAME one swappable `require_visible` function VIS-01 already built, with a Glean precedence-merge rule (highest role wins for primary tier, union for secondary grants).
  4. A user picks a default (e.g. model) WITHIN the operator/org-allowed set — the revived `user_settings.preferences` layer (dead since mig 011) honors operator lock flags under the SEED-116 two-layer pattern (VIS-02).
**Plans**: TBD
**UI hint**: yes

#### Phase 168: SSO — SAML 2.0 (CORE)
**Goal**: An org-admin can register a SAML 2.0 IdP via Supabase's native SP with JIT provisioning and email-domain routing, while email/password fallback stays — the enterprise-onboarding capstone with zero downstream dependents (first-to-cut).
**Depends on**: Phase 167 (JIT seam). LAST in CORE (heaviest external IdP dependency; invitations already cover onboarding if cut).
**Requirements**: SSO-01
**Success Criteria** (what must be TRUE):
  1. An org-admin registers a SAML 2.0 IdP via Supabase's native SAML SP (Cloud Pro+ managed OR self-hosted GoTrue, un-gated), provisioned via `supabase sso add`; users route to it by email domain.
  2. On first SSO login, JIT provisioning (INV-02's seam) creates the `org_members` row, and attribute→claim mapping feeds department import.
  3. Email/password fallback is RETAINED (SSO enforcement explicitly deferred) — an existing user can still sign in the old way; no `python3-saml` (Supabase owns the SAML parsing).
**Plans**: TBD
**UI hint**: yes

#### Phase 169: Dept-Admin Shell (STRETCH)
**Goal**: A narrower dept-admin shell lets a department admin manage their department's members / skills / retention / audit — a scoped-down composition of the org-admin shell.
**Depends on**: Phase 166 (org-admin shell pattern) + Phase 167 (roles/dept schema live); gated behind CORE
**Requirements**: ADMIN-06
**Success Criteria** (what must be TRUE):
  1. A user with `dept:manage` sees a dept-admin shell (Dept Members / Dept Skills / Dept Retention / Dept Audit) scoped to their department only.
  2. A dept-admin cannot see or act on other departments' members or resources.
**Plans**: TBD
**UI hint**: yes

#### Phase 170: Commercial Footholds — Entitlements + Retention/Rate-Limit Data Layer (STRETCH)
**Goal**: A reusable entitlement-check primitive replaces the lying stub, and per-org retention/rate-limit gets its data layer + org-admin UI — commercial footholds only, no enforcement, no billing.
**Depends on**: Phase 161 (`subscription_tier`/`add_ons` columns) + Phase 166 (org-admin UI); gated behind CORE
**Requirements**: ENT-01, ENT-02
**Success Criteria** (what must be TRUE):
  1. `require_tier()` / `require_add_on()` read `orgs.subscription_tier` / `add_ons` and gate a feature honestly — the `_is_tier_pro_or_higher` stub that unconditionally returns `True` is replaced (SEED-080).
  2. Per-org retention + rate-limit settings have a data layer + an org-admin UI surface (schema + surfaces only — the sweeper / Redis token-bucket enforcement stays deferred to v3.5/v3.6).
**Plans**: TBD
**UI hint**: yes

#### Phase 171: Permission-Aware Citations (STRETCH)
**Goal**: An answer never cites or previews a document the asking user cannot open — the Glean citation-safety guarantee, gated on a leak threat model + a pgvector+RLS benchmark and on dept/role folder-sharing stabilizing first.
**Depends on**: Phase 164 (retrieval RLS) + Phase 167 (dept/role folder-sharing stabilized); research-gated; gated behind CORE
**Requirements**: PRAG-02
**Success Criteria** (what must be TRUE):
  1. A CITE-01 leak threat model + a pgvector+RLS latency/recall benchmark are completed FIRST and show the guarantee is buildable without moving the CONCUR-01 gate.
  2. An answer's citations/previews only ever name documents the asking user may open — a cross-org or unauthorized-folder document is never cited/previewed, proven with a live two-user test.
**Plans**: TBD
**UI hint**: yes

#### Phase 172: OIDC Enterprise SSO (STRETCH)
**Goal**: Per-org OIDC enterprise SSO via a custom Authlib SP — the one org-SSO protocol Supabase does not offer natively — built only if a customer forces OIDC into scope.
**Depends on**: Phase 168 (SSO SAML seam + JIT); gated behind CORE + a customer trigger
**Requirements**: SSO-02
**Success Criteria** (what must be TRUE):
  1. An org-admin can register an OIDC IdP (custom Authlib SP) and users route to it by email domain, reusing the Phase-168 JIT provisioning seam.
  2. Email/password + SAML fallback remain, and OIDC discovery is SSRF-guarded.
**Plans**: TBD
**UI hint**: yes

#### Phase 173: Dept-Targeted Skills + Group Feature-Rollout Gating (STRETCH)
**Goal**: Skills/automations can be targeted to departments, and admin tiers + beta/feature-rollout gating can be assigned to groups — folding into the already-rewritten skills RLS + greenlist substrate.
**Depends on**: Phase 165 (skills RLS rewritten) + Phase 167 (greenlists/roles); gated behind CORE
**Requirements**: VIS-03, VIS-04
**Success Criteria** (what must be TRUE):
  1. A skill/automation can be made available to a specific department (folds into the skills RLS), and members of other departments don't see it.
  2. Admin tiers are assignable to groups, and per-group beta / feature-rollout gating routes a feature to a named group through the VIS-01 greenlist resolver (VIS-04).
**Plans**: TBD
**UI hint**: yes

### Progress

**Execution Order:** Phases execute in numeric order 160 → 161 → … → 168 (CORE), then 169 → 173 (STRETCH, gated behind CORE completion + budget).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 160. Tenancy-Model ADR | 1/1 | Complete | 2026-07-18 |
| 161. Org / Dept / Role Schema | 2/2 | Complete | 2026-07-18 |
| 162. Personal-Org Backfill | 3/3 | Complete | 2026-07-18 |
| 162.5. threads.py Producer Extraction (G-5) | 4/4 | Complete | 2026-07-19 |
| 163. RLS Rewrite + User-JWT Client Swap (CRUX) | 11/11 | Complete | 2026-07-20 |
| 164. SECDEF Audit + Cross-Org Isolation Suite | 5/5 | Complete | 2026-07-20 |
| 165. `is_global` Retirement Cleanup | 12/12 | Complete | 2026-07-21 |
| 166. Org-Admin Shell + Switcher + Profile + Audit + Settings Split | 0/? | Not started | - |
| 167. Invitations + Roles + Greenlists + JIT + Per-User Prefs | 0/? | Not started | - |
| 168. SSO — SAML 2.0 (CORE) | 0/? | Not started | - |
| 169 (STRETCH). Dept-Admin Shell | 0/? | Gated (behind CORE) | - |
| 170 (STRETCH). Commercial Footholds | 0/? | Gated (behind CORE) | - |
| 171 (STRETCH). Permission-Aware Citations | 0/? | Gated (behind CORE + research) | - |
| 172 (STRETCH). OIDC Enterprise SSO | 0/? | Gated (behind CORE + customer trigger) | - |
| 173 (STRETCH). Dept-Targeted Skills + Group Gating | 0/? | Gated (behind CORE) | - |

### Guardrails, gates & sequencing (v3.4)

- **Coverage:** 29/29 requirements mapped (22 CORE → 160-168; 7 STRETCH → 169-173); 0 unmapped, 0 duplicates. Every requirement → exactly one phase.
- **The atomic crux (LOCKED — do not reorder):** TEN-01 + TEN-02 + TEN-04 ship in ONE phase (163). RLS is inert while the service-role / asyncpg-owner connection bypasses it — "policies now, client later" is forbidden. This is the milestone's highest-signal research convergence.
- **G-5 / G-1 — `threads.py` extraction-first (flagged explicitly):** `threads.py` (~1850 LOC, 6+ prior phases; CLAUDE.md ledger = "extraction due") is G-5-firing. The overdue extraction refactor is sequenced as **Wave 0 of Phase 163**, BEFORE `org_id` is threaded through `send_message`. Per G-5/G-1's stated preference this MAY be promoted to a **dedicated refactor phase immediately before the crux** at discuss/plan-time (operator's call) — if promoted, it becomes Phase 163 and the crux shifts to 163.1 (STRETCH renumbers accordingly). Either way, **no `org_id` touches `send_message` until the extraction lands.** Prior 147/149 in-place `threads.py` guard overrides are logged in STATE.md; this milestone finally pays the extraction down.
- **Data-dependency order (forced):** ADR (160) → schema-additive (161) → backfill (162) → atomic RLS+client-swap crux (163) → SECDEF audit + two-org isolation suite (164) → `is_global` retirement (165) → org-admin shell/switcher (166) → invitations/roles/greenlists/JIT/prefs (167) → SSO SAML (168, last). You cannot flip `org_id NOT NULL` before backfilling; RLS predicates are meaningless before the column is populated; the `match_document_chunks` INVOKER rewrite needs `document_chunks`'s new `org_id`/RLS to exist first.
- **SC#10 (cross-provider mandate):** flagged on the phases touching the shared streaming / agent-loop / provider-routing / UI-state path — **163** (crux — shared retrieval/agent-loop path), **164** (SECDEF / permission-aware retrieval), **166** (org-switcher / `<OrgContext>` — UI state + stream teardown), **167** (VIS-02 per-user model-default = provider routing; greenlist = UI state), and STRETCH **171** (permission-aware citations — retrieval/citation path). Multi-tenancy is mostly backend-auth, so the pure-schema/ADR phases (160/161/162/165) are deliberately NOT SC#10-flagged.
- **Threat model / secure-phase:** the whole isolation cluster (**161** schema, **162** backfill, **163** RLS crux, **164** SECDEF audit — the milestone's security core), **165** (lighter — `is_system_global` migration-only), **166** (X-Org-Id server-validate + org-scoped-audit authz), **167** (invitation token/expiry + JIT advisory-lock race), **168** (SSO — Supabase owns SAML XML parse, so the surviving risks are JIT race [covered 167] + enforcement-before-fallback), plus STRETCH **171** (CITE-01 leak) + **172** (OIDC discovery SSRF). ADR (160) has no code → no threat model.
- **Milestone exit gate:** the two-org `test_v3_4_org_isolation.py` suite (built in 164) is BOTH the Phase-164 gate AND the milestone-closing gate — **re-run after 168 (SSO) / 167 (invitations) / 166 (admin-UI) all land**, PLUS a final full-regression pass (SC#10 4-axis + CONCUR-01 <1s). "Looks isolated" from a one-org suite is worthless (every existing fixture is single-tenant by construction and stays green even if isolation is completely broken).
- **G-2 sketch-gated:** **166** (org-admin shell / org switcher / profile-menu identity anchor — live UI/panel/badge, pairs with SEED-113), **167** (greenlist / roster UI if visual), and STRETCH **169** (dept-admin shell). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names the operator Control-Room shell + the profile-menu anchor + the 148 roster this composes on.
- **G-5 hot files (audit at discuss-phase):** `backend/app/api/threads.py` (**163** — extraction-first, above), `frontend/src/providers/StreamsProvider.tsx` (**166** — `<OrgContext>` wraps OUTSIDE it; preserve the Phase-067.5 Branch-D3 clear guard verbatim), and (STRETCH) `backend/app/services/retrieval_service.py` + the citation renderer (**171** if PRAG-02 is built).
- **Perf gate (CONCUR-01):** TEN-04 (**163**) — `document_chunks` / `skill_embeddings` `org_id` denormalize + index — must keep the CONCUR-01 <1s cross-tab-GET-during-streaming binding gate green; benchmark BEFORE merge (a per-row membership join over a seq-scan on the pgvector hot path is the single largest perf threat).
- **Research-phase recommended (per SUMMARY flags):** **163** crux (live two-user `SET LOCAL`/`SET ROLE` leak test — the exact semantics are MEDIUM-confidence; do NOT ship on documentation alone) and STRETCH **171** citations (pgvector + RLS/HNSW latency AND ANN-recall are completely unmeasured — benchmark before promising the guarantee). Also unresolved: the personal-org/JIT provisioning seam (162/167 boundary — trigger vs app-layer vs BOTH). Skip research-phase: 160 (ADR), 161 (textbook DEFINER-helper), 165 (mechanical rename), 166 (reuses v3.3 shell).
- **Red line (D-14):** Deep Mode stays byte-identical; provider differences at the gateway/adapter boundary; no new runtime. The ~253 `.eq("user_id")` filters stay as belt-and-suspenders under the user-JWT client — KEEP them this milestone.
- **Reported-bugs:** the chat-surface backlog (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04, …) stays OUT of v3.4 (its own planned post-v3.3 chat-polish phase); only **SEED-091 folds here** (TEN-06 → Phase 164). External reports are never auto-folded. Cross-check at each `/gsd:discuss-phase`.
- **Cloud parity owed (standing rule):** v3.3 migrations 099-103 + `SECRETS_ENCRYPTION_KEY` are still owed at the next production push; v3.4 migrations start at slot 104 (order matters — paste into the cloud Supabase SQL editor, never `db push`).

---

## v3.3 Operator UX — ✅ SHIPPED 2026-07-18

Full detail archived → **`.planning/milestones/v3.3-ROADMAP.md`** · requirements → **`.planning/milestones/v3.3-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

14 phases (146–159), 95 plans, 212 tasks. Made the platform operable + configurable by a non-developer operator from the UI. **Operator tier (146–148):** a gated `/admin` Control Room behind a byte-identical-404 `require_operator` gate (no RLS backstop — app-layer isolation) + operator audit ledger — health, active-runs + Kill, fail-closed capability kill-switches, maintenance/read-only mode, audit browser, user roster, API-enforced feature visibility. **Model & secrets (149–150, 159):** a dynamic model-capability registry + live propose-only discovery (no restart, no silently-guessed capabilities), add-model-by-ID + utility-filtered discovery curation (159), and app-layer Fernet secrets-at-rest with env-fallback. **Files & workflows (151–152):** `fetch_document_file` + `attach_skill_file` agent tools, Run-modal file-input + per-run KB-folder scope + safe workflow delete. **Trust & friendliness UX (153–156):** per-claim inline citations keyed to the run's real retrieval set, an app-wide plain-language layer behind an advanced reveal, a WCAG-AA sweep, everyday nav/thread polish. **Deployment (157–158):** Solo/Team/Enterprise presets + `docker-compose.prod.yml` + `OPERATOR.md`, and an idempotent lock-after-finalize install wizard at `/setup`. 20/20 requirements (16 CORE + 4 STRETCH); WFIN-02 one operator-accepted OpenRouter-axis limitation (external BUG-260714-02). Migrations 095–103; `SECRETS_ENCRYPTION_KEY` env. Threat-secured across 146–150 / 153 / 154 / 158 / 159 (`threats_open: 0`).

---

## v3.2 Skill Eval Studio + Self-Improving — ✅ SHIPPED 2026-07-10

Full detail archived → **`.planning/milestones/v3.2-ROADMAP.md`** · requirements → **`.planning/milestones/v3.2-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

16 phases (132, 133, 134, 134.1, 135, 136, 137, 137.1, 137.2, 138, 139, 140, 141, 142, 143, 145), 81 plans. Turned the v3.1 Skill Trigger Tuner into a full **Skill Eval Studio**: persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel — plus a built-in skill-creator (every user, read-only + protected), STRETCH honesty phases (run-end honesty, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill-script honesty), the FND-01 run-lifecycle foundation (`runs.status` authoritative + `threads.py` G-5 extraction, live SC#10 UAT 6/6), and a curated **Starter Workflow Library** (WF-01 — 3 KB→document starters proven live end-to-end: fork → judge-approved publish gauntlet → cited `.docx`).

**Deferred → v3.3:** FILE-01 (Phase 144, Agent-Driven Skill File Attachment — gated STRETCH, not executed; rolls forward with the workflow-file cluster SEED-110/112). **Verification debt:** live UATs pending/partial on 140/141/142/143 (see MILESTONES.md → Known Gaps).

**Next:** v3.3 Operator UX (authoritative map: `PRDs/SEQUENCE.md`).

---

## v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers — ✅ SHIPPED 2026-06-28

**Started:** 2026-06-21 (Option A — scope LOCKED + operator-approved). Numbering continues from v3.0's last phase (119) → **CORE Phases 120-124**, then **STRETCH Phases 125-131** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent). *Phase 131 (SRH-01, non-Python skill-script honesty) folded in 2026-06-22 after a JS-skill-import investigation — SEED-044 Layer 1; the full Node-execution capability stays v3.2 DISC-01.*

**Goal:** Make the agent's skills + workflows trustworthy, legible, and reliably triggered across *all* providers — fix the live workflow↔skill collision (a confirmed, root-caused bug), lift cross-provider honesty to OpenAI-parity, add a Skill Trigger Tuner, and re-skin the Workflow Studio so each workflow's "soul" is obvious with a strict↔loose authoring/running split.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Scope source:** `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (LOCKED). Operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`.

### Phase Table (CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 120 | Collision Fix + Context Isolation | A skill saving one file in a workflow-touched thread emits exactly that file, and Deep/Harness stop replaying each other's history | COLL-01, CTX-01 | 4 | G-5 (`threads.py` firing → extraction due, `agent_loop.py` `_reconstruct_history`); SC#10 |
| 121 | One Front Door for Workflows (IA) | Workflows launch from a single front door; the chat composer drops to 2-pill General/Explorer while the lock/409/reconcile is preserved | IA-01 | 3 | G-2 sketch-gated; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | Cross-provider emission is recovered-or-honest, doc-verified per provider, measured on a per-provider scoreboard, and task labels are concrete on every provider | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter boundary, `agent_loop.py`); SC#10 (cross-provider = EVAL axis, MP-03) |
| 123 | Skill Triggering Quality | A skill author can tune a description against a held-out benchmark, weak descriptions are flagged at save, and loaded skills don't fall out of context mid-session | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim path for CTX-03); SC#10 (TRIG-01 cross-provider) |
| 123.1 (INSERTED) | Skill Trigger Tuner — Design Fidelity & UX Polish | The Trigger Tuner result surface reads cleanly at the org's real provider count, the seeded benchmark is visible/editable before running, a completed result survives refresh, and the builder model is choosable from configured models | TRIG-01 (gap-closure, BUG-260624-01) | TBD | G-2 sketch-gated (sketches 041–044 exist); frontend-heavy; SC#10 (cross-provider legibility) |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | A user sees a workflow's "soul" at a glance in 3 sizes and meets a clear strict↔loose split ("Describe & run" vs "Author & govern") | WUX-01, WUX-02 | 4 | G-2 sketch-gated (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

### Phase Table (STRETCH — gated behind CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 125 | Self-Improve Proposer (description-only) | A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; never auto-publishes | SI-02 (STRETCH) | 3 | SC#10 (judge-as-gate cross-provider); depends on 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | Only plausibly-relevant skills are surfaced to the model and the catalog stays within a token budget | TRIG-02 (STRETCH) | 3 | G-5 (catalog injection path); SC#10; depends on 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand; idle PhaseCards stay quiet | WUX-03 (STRETCH) | 2 | G-2 sketch-gated; UI hint; G-5 (`PhaseCard.tsx`); depends on 124 |
| 128 | Chat Tool-Card Unification + Chat-Area Reclaim | One honest, unified, space-efficient chat surface across every provider: live description before `tool_start` + provider logos in the tool-card header + a tool card that uniformly carries all run info + removing the redundant sticky composer timer + Read-more on long prompts | TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH) | 5 | **G-2 sketch-gated** (now visual); SC#10 (cross-provider tool-card parity); **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/`ChatArea.tsx` — audit refactor-vs-feature at discuss); depends on 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness | MP-04 (STRETCH) | 2 | G-5 (gateway/adapter boundary); SC#10; depends on 122 |
| 130 | template_input Resolver Run-Scope | The `template_input` resolver is run-scoped too — defense-in-depth for the `render_template` path alongside COLL-01 | COLL-02 (STRETCH) | 2 | depends on 120 |
| 131 | Non-Python Skill-Script Honesty | A user importing/running a skill with a non-Python script (e.g. `.js`) gets an honest message instead of a silent failure; instructions still work | SRH-01 (STRETCH) | 3 | additive, OFF the COLL-01 seam; SEED-044 Layer 1; precursor to v3.2 DISC-01 |

### Phase Checklist

- [x] **Phase 120: Collision Fix + Context Isolation** — run-scope the sandbox harvest baseline (kills the live 2-files bug) + tag `messages.origin` so Deep/Harness stop replaying each other (COLL-01, CTX-01) ✓ 2026-06-22
- [x] **Phase 121: One Front Door for Workflows (IA)** — remove the composer Harness pill → 2-pill General/Explorer, keep the lock/409/reconcile (IA-01) ✓ 2026-06-23
- [x] **Phase 122: Cross-Provider Trust & Honesty Parity** — force→coerce retry ladder, doc-verified `emit_tier`, per-provider scoreboard, OpenAI-parity task labels (MP-01, MP-02, MP-03, TDP-01) ✓ 2026-06-23
- [x] **Phase 123: Skill Triggering Quality** — Skill Trigger Tuner, save-time description lint, pin loaded skills out of trim (TRIG-01, TRIG-03, CTX-03) ✓ 2026-06-26 (all 3 gates: secure 29/29 · validate NYQUIST 12/12 · verify 12/12 + SC#10 4-axis live UAT 4/4 PASS)
- [x] **Phase 123.1 (INSERTED): Skill Trigger Tuner — Design Fidelity & UX Polish** — fix the cramped N-provider scoreboard, show/edit seeded cases, persist results across refresh, builder-model = configured models, restore dropped sketch elements (gap-closure for 123, BUG-260624-01)
 (completed 2026-06-25)

- [x] **Phase 124: Workflow Studio UX — Soul + Strict↔Loose** — soul in 3 sizes + strict↔loose disclosure (WUX-01, WUX-02) — 3 plans ✓ 2026-06-26 (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 PASS · CORE complete)
- [ ] **Phase 125 (STRETCH): Self-Improve Proposer (description-only)** — bounded human-in-the-loop description proposer (SI-02)
- [ ] **Phase 126 (STRETCH): Smart-Dispatch Relevance Pre-Filter** — relevance pre-filter + catalog token budget (TRIG-02)
- [x] **Phase 127 (STRETCH): Gauntlet Pip-Strip + Quiet Idle Cards** — pip-strip + worded verdict, quiet idle cards (WUX-03) — 3 plans (executed + code-verified 2026-06-27; manual UAT pending)
- [ ] **Phase 128 (STRETCH): Chat Tool-Card Unification + Chat-Area Reclaim** — live description before `tool_start` + provider logos in the tool-card header + uniform cross-provider tool card + remove the redundant sticky composer timer + Read-more on long prompts (TDP-02, CTC-01..04)
- [x] **Phase 129 (STRETCH): MiniMax/OpenRouter Arg Repair** — MiniMax-gated arg-repair guard (single-shot re-ask → recover or honest-fail) + OpenRouter `require_parameters` in the quality strategy (MP-04) — 3 plans ✓ 2026-06-27 (verify 11/11 · 12 unit tests green · SC#10 live 7/9 rows PASS, both load-bearing changes live-verified — OpenRouter API accepts `require_parameters` (R9), no regression on OpenAI/Anthropic/Google/MiniMax; repair rungs unit-proven, truncation trigger now dormant (cap moved 8192→9987+); BUG-260607-03 folded)
- [ ] **Phase 130 (STRETCH): template_input Resolver Run-Scope** — run-scope the render_template resolver (COLL-02)
- [ ] **Phase 131 (STRETCH): Non-Python Skill-Script Honesty** — honest import/exec message when a skill bundles a non-Python script the sandbox can't run; optional read-as-text for `.js` (SRH-01)

### Phase Details

#### Phase 120: Collision Fix + Context Isolation

**Goal**: A skill that runs in a thread that previously ran a workflow emits only its own output, and a subsequent Deep turn never replays the workflow's history — the live, root-caused collision (Mechanism A) is closed at the harvest baseline and the history-reconstruction filter.
**Depends on**: Nothing (first phase; sequenced EARLY because COLL-01 is a confirmed live bug)
**Requirements**: COLL-01, CTX-01
**Success Criteria** (what must be TRUE):

  1. A skill `execute_code` that saves exactly one file in a thread that previously ran a workflow emits exactly that one file — the prior workflow's leftover `/sandbox/output/` artifact is never re-emitted (the confirmed 2-files bug is gone).
  2. The sandbox-output harvest is run-scoped to its own run's baseline, so any file present before the run starts is excluded from that run's emitted outputs.
  3. When Deep chat and a workflow share a thread, a Deep turn's history reconstruction replays only `messages.origin = deep` rows, and a workflow phase replays only its `harness` rows — workflow context never bleeds into a subsequent Deep turn.
  4. The collision fix holds across providers, multi-tool prompts, parallel threads, and long (≥50-message) histories — Deep Mode stays byte-identical on the native-7 (no shared-path fork; SC#10).

**Plans**: 3 plans

- [x] 120-01-PLAN.md — COLL-01: run-scope the sandbox-output harvest (snapshot+hash baseline seed) + headline live-repro regression test
- [x] 120-02-PLAN.md — CTX-01: author migration 076 (messages.origin) + tag every harness insert site + asymmetric origin filter at agent_loop.py:1024
- [x] 120-03-PLAN.md — [BLOCKING] apply migration 076 to live DB (SQL-editor paste) + regenerate full-schema.sql + live-DB integration test

#### Phase 121: One Front Door for Workflows (IA)

**Goal**: A user launches workflows from a single, obvious front door (the Workflows page); the chat composer is simplified to a 2-pill General/Explorer control with the Harness pill and in-chat workflow selector removed, while the existing Harness↔Deep lock / 409 / reconcile behavior is preserved exactly.
**Depends on**: Phase 120 (context isolation is the actual collision fix; IA-01 is the clarity win that rides on top — and they touch overlapping thread/composer surfaces)
**Requirements**: IA-01
**Success Criteria** (what must be TRUE):

  1. The chat composer shows exactly two mode pills (General / Explorer) — the Harness pill and the in-chat workflow selector are gone, and the only place to launch a workflow is the Workflows page.
  2. Launching a workflow still works as an explicit "launch-in-context" action (the capability is not removed), and a launched workflow's thread still toggles into Harness mode and Continues correctly.
  3. The server-side Harness↔Deep lock still returns a 409 on an illegal switch, and the lock/reconcile behavior is unchanged from before the composer change.
  4. Behavior holds across providers and parallel threads with no Deep-mode regression (SC#10).

**Plans**: 2 plans

- [x] 121-01-PLAN.md — remove the Deep/Harness toggle + in-chat workflow picker (2-pill composer); preserve lock/409/reconcile + composer-stop Cancel (SC#1/SC#3)
- [x] 121-02-PLAN.md — rewrite ChatAreaMode + extend ChatAreaBanner + new ChatLayout launch test (SC#1/SC#2/SC#3 oracles)

**UI hint**: yes

#### Phase 122: Cross-Provider Trust & Honesty Parity

**Goal**: Structured emission is recovered-or-honest on every provider, each provider uses the emission path it actually supports (doc-verified, not guessed), cross-provider reliability is measured on a per-provider scoreboard that gates any tier change, and task/step labels are concrete on every provider (OpenAI-parity) — all at the gateway/adapter boundary, never the shared path.
**Depends on**: Phase 120 (lands after the collision fix so the cross-provider blast radius is clean)
**Requirements**: MP-01, MP-02, MP-03, TDP-01
**Success Criteria** (what must be TRUE):

  1. A model that silently fails a forced structured emit (e.g. the default model's no-metadata 400) is recovered by a force→coerce retry ladder in `forced_emit`, so a typed-artifact phase produces its emission instead of a silent empty result.
  2. Each provider's forcing/strict behavior is honest and doc-verified — an explicit `emit_tier` field replaces guesswork, the inert DeepSeek function-level `strict` is dropped, and GLM forcing is kept (intentional, live-verified).
  3. The eval treats provider as a first-class axis with a per-provider scoreboard (trigger / force / recovery / honest-fail), pass-OR-documented, and any `emit_tier` change is gated on that scoreboard (no silent tier flip).
  4. Task/todo/workflow-step labels are concrete on every provider (OpenAI-parity), not the bare tool name — an ungated prompt nudge fills `execute_code.description` and a deterministic frontend summarizer floor backstops providers that don't, without regressing providers that already do.
  5. The 4-axis SC#10 scoreboard (cross-provider × multi-tool × parallel-thread × long-message) passes as an EVAL axis (per MP-03), and Deep Mode stays byte-identical (no shared-path fork).

**Plans**: 4 plans

- [x] 122-01-PLAN.md — MP-02: explicit emit_tier field + 55-row registry migration (14/2/34/5) + remove the provider=="openai" gate + inert DeepSeek strict
- [x] 122-02-PLAN.md — MP-01: the ordered force_strict→non-strict→coerce→fail rung ladder inside forced_emit (reads emit_tier) + emit_rung telemetry
- [x] 122-03-PLAN.md — MP-03: --forced-emit scoreboard matrix (EASY+HARD × native-7, 4 axes PASS/FAIL/DOCUMENTED) + dated artifact + README grep ritual
- [x] 122-04-PLAN.md — TDP-01: ungated execute_code.description SYSTEM_PROMPT nudge + verified frontend label floor

#### Phase 123: Skill Triggering Quality

**Goal**: A skill author can measurably tune a skill's trigger description, the system flags weak trigger descriptions before a skill is saved, and a loaded skill's instructions stay available for the rest of the session instead of silently falling out of context.
**Depends on**: Phase 122 (the Trigger Tuner measures cross-provider on production model-ids; it reuses the per-provider scoreboard substrate landed in 122)
**Requirements**: TRIG-01, TRIG-03, CTX-03
**Success Criteria** (what must be TRUE):

  1. A skill author can run a description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner) and pick the winning description by held-out score, measured cross-provider on production model-ids.
  2. The Trigger Tuner reports a concrete trigger/should-not score per candidate description so the author can see one description beat another, not just a pass/fail.
  3. At `save_skill` (and in the skill-creator loop) a description-quality lint flags a weak or ambiguous trigger description before the skill is saved.
  4. A skill loaded mid-conversation stays in context for the rest of the session — its instructions are pinned out of the rolling trim window and don't silently disappear after the window rolls.
  5. Trigger measurement and the pinned-instruction behavior hold across providers and long histories (SC#10) with no shared-path fork on the trim path.

**Plans**: 6 plans

- [x] 123-01-PLAN.md — TRIG-03 deterministic save-time lint (3 hook points, warn-never-block) + D-01 catalog-note relaxation (shared LOAD_SKILL_POLICY)
- [x] 123-02-PLAN.md — CTX-03 trim-pin: load_skill tool-result as a third protected class in trim_messages_to_fit (de-dupe, 1/3 budget, LRU evict + marker) + reconstruct tag (G-5 RED LINE)
- [x] 123-03-PLAN.md — TRIG-01 core: D-08 builder-model knob + skill_tuner_service (candidates, policy-faithful classification, 60/40 held-out scoring, N-column adaptivity, owner-scoped auto-seed)
- [x] 123-04-PLAN.md — TRIG-01 routes: owner-scoped skill_tuner router (bounded background job over the run-buffer + tuner-specific SSE + held-out scoreboard)
- [x] 123-05-PLAN.md — TRIG-01 UI: focused full-surface Trigger Tuner (reachability triad) — case editor, N-column scoreboard (fires/no-false), candidate cards, live-run card, author-confirm diff (041-A/042-A/043-A)
- [x] 123-06-PLAN.md — TRIG-03 UI loop: inline never-block lint warning + "Tune this" handoff + the D-08 builder-model Settings picker (044-A)

### Phase 123.1: Skill Trigger Tuner — design fidelity and UX polish (INSERTED)

**Goal:** The Skill Trigger Tuner reads cleanly at the org's real provider count, makes the benchmark visible/editable before a run, makes a completed result durable across refresh/restart, and lets the builder model be chosen from configured models — closing the live-UAT design-fidelity + UX gaps in BUG-260624-01 (HIGH + MED) without changing the scoring core, the agent loop, the shared chat path, or the CTX-03 trim-pin.
**Requirements**: TBD (scope contract = the 12 locked decisions D-01..D-12 in 123.1-CONTEXT.md + the live-UAT audit backlog TT-05/07/08/09/10/11/12/14/15/16 in 123.1-AUDIT-BACKLOG.md; each is covered by >=1 plan)
**Depends on:** Phase 123
**Plans:** 10/10 plans complete

Plans:

- [x] 123.1-01-PLAN.md — Backend seam: tuner_runs table (migration 077) + durable latest-result upsert + GET-latest + seeded-cases GET + frontend wire (D-01/D-05/D-07/D-08)
- [x] 123.1-02-PLAN.md — Scoreboard polish: ProviderScoreboard vertical rows + magnitude bar + combined score; CandidateCard line-clamp/expand (D-02/D-04/D-11/D-12)
- [x] 123.1-03-PLAN.md — Settings builder-model picker from configured models + soft hint; remove IN-02 placeholders (D-09/D-10)
- [x] 123.1-04-PLAN.md — Page integration: full-width results, seeded-case hydrate/edit, standalone live-description scoreboard, result rehydration, pre-run cost preview + attribution (D-03/D-05/D-06/D-07/D-12)
- [x] 123.1-05-PLAN.md — [Wave 1] Editor-wall fix (sketch 045-B): backend seed-cap (MAX_SEEDED_SHOULD_NOT) + seeded GET `total` + legible/bounded CaseEditor + full-width pre-run stack (BUG-260624-01; seed-cap now load-bearing for RUN TIME per backlog section 5)
- [x] 123.1-06-PLAN.md — [Wave 2] Backend honesty: empty axis -> n/a not 1.0 (TT-05); all-error column -> unmeasured, excluded from target_count (TT-12); single-source cell_score (TT-15)
- [x] 123.1-07-PLAN.md — [Wave 3] Run UX: emit stage=provider_start so lanes flip queued->running (TT-07); real owner-scoped + run<->skill-bound DELETE cancel route + job checkpoint + claim release (TT-08)
- [x] 123.1-08-PLAN.md — [Wave 4] Run resilience: honest seeded-fetch note (TT-09); unmeasured-cell render (TT-12 render half); reconciling sub-state no-flash (TT-14); durable-poll reconnect honesty (TT-16)
- [x] 123.1-09-PLAN.md — [Wave 5] Layout: delete both decorative bg-sidebar deco-rails on SkillsPage + SkillTunerPage (TT-11)
- [x] 123.1-10-PLAN.md — [Wave 1] Observability: silence the LangSmith 429 uploader flood to ERROR + document LANGSMITH_TRACING_SAMPLING_RATE (TT-10)

#### Phase 124: Workflow Studio UX — Soul + Strict↔Loose

**Goal**: A user immediately sees the "soul" of a workflow (its purpose, what it needs, its phase spine, its tier, its output) in three consistent sizes, and meets a clear strict↔loose disclosure that offers two doors ("Describe & run" vs "Author & govern") without removing any control — accuracy and governance preserved, complexity demoted one click.
**Depends on**: Phase 121 (the Workflows page is now the single front door; the soul re-skin builds on that consolidated surface)
**Requirements**: WUX-01, WUX-02
**Success Criteria** (what must be TRUE):

  1. A user sees a workflow's "soul" at a glance in three sizes (library card / run header / publish summary): its purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line.
  2. The library card / run header / publish summary all show the same soul object consistently — a user recognizes a workflow by the same essence in all three places.
  3. Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed and advanced controls are demoted exactly one click.
  4. The strict↔loose split preserves accuracy and control — a power user can still reach every advanced control, and a loose user can describe-and-run without meeting governance complexity (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans

- [x] 124-01-PLAN.md — Wave 0 foundation: extract shared soulData (tierForDefinition + PHASE_GLYPHS + needs/deliverable) + net-new WorkflowSoul (3 sizes) + glyph-dot PhaseSpine (WUX-01)
- [x] 124-02-PLAN.md — card-scale soul on library cards + the two-door fork (Describe & run / Author & govern) at the Studio authoring entry; library-card Run preserved (WUX-01, WUX-02)
- [x] 124-03-PLAN.md — run-surface soul as a G-5 additive sibling in WorkspacePanel + publish-summary soul block prepend (D-06 ladder untouched) (WUX-01)

**UI hint**: yes

#### Phase 125: Self-Improve Proposer (description-only)

**Goal**: A bounded, human-in-the-loop, description-only self-improvement proposer: eval surfaces a weak description → proposes a description diff → DRAFT → human approves → a new immutable version; it never auto-publishes, uses held-out selection, and uses the Phase-102 judge as a gate.
**Depends on**: Phase 122 + Phase 123 (reuses the cross-provider scoreboard, the Trigger Tuner's held-out selection, and the judge gate); gated behind CORE completion
**Requirements**: SI-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The proposer can take an eval signal on a weak description and produce a proposed description diff as a DRAFT — it never edits a live skill description and never auto-publishes.
  2. A human reviews the proposed diff and, on approval, the proposal becomes a new immutable version; on rejection nothing changes.
  3. A proposed description is selected by held-out score and must clear the Phase-102 judge gate before it can be presented as a recommendation.

**Plans**: TBD
**UI hint**: yes

#### Phase 126: Smart-Dispatch Relevance Pre-Filter

**Goal**: Only plausibly-relevant skills are surfaced to the model and the skill catalog stays within a token budget, so the model isn't flooded with irrelevant skills and the catalog doesn't blow the context budget.
**Depends on**: Phase 123 (builds on the skill-triggering work); gated behind CORE completion
**Requirements**: TRIG-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected.
  2. The injected skill catalog stays within a defined token budget even as the user's skill count grows.
  3. The pre-filter never starves a genuinely-relevant skill (a should-trigger skill still reaches the model), verified cross-provider (SC#10).

**Plans**: TBD

#### Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards

**Goal**: The publish gauntlet reads at a glance as a pip-strip + worded verdict with raw detail on demand, and idle PhaseCards stay visually quiet instead of competing for attention.
**Depends on**: Phase 124 (rides on the Workflow Studio UX re-skin); gated behind CORE completion
**Requirements**: WUX-03 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The publish gauntlet renders as a pip-strip + a worded verdict, with the raw gauntlet detail available on demand (not shown by default).
  2. An idle PhaseCard stays quiet (no noisy animation/placeholder) and only animates when its phase is actually active (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans (planned 2026-06-27)

- [x] 127-01-PLAN.md — Icon foundation: build-time 3D-icon mechanism (unplugin-icons) + shared PHASE_GLYPHS 3D swap + PhaseSpine test migration
- [x] 127-02-PLAN.md — Publish gauntlet re-skin: energy-spine + worded verdict + raw-on-demand + golden-run hero (honesty contracts intact)
- [x] 127-03-PLAN.md — Living step-flow re-skin: quiet idle / bloomed active (activity line + engine chip) / folded done (G-5 PhaseCard/PhaseTimeline)

**UI hint**: yes

#### Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim

**Goal**: One honest, unified, space-efficient chat surface across every provider — the tool card becomes the single canonical place for live run info, it reads identically on all providers, redundant chrome is removed, and every pixel of the chat area earns its place.
**Depends on**: Phase 122 (extends the task-label parity / tool-card honesty work); gated behind CORE completion
**Requirements**: TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH)
**Reframed** 2026-06-27 (operator): the original narrow "Live Description Before tool_start" (TDP-02) was bundled with four operator-raised chat-surface improvements (CTC-01..04) because they share the same surface + G-5 hot files (`ToolCallPanel.tsx` / `MessageItem.tsx` / `ChatArea.tsx`) and one coherent vision — better as one sketched pass than five scattered inserts.
**Success Criteria** (what must be TRUE):

  1. A tool's `description` appears in the preparing window before the `tool_start` event fires (TDP-02), so the user sees what the agent is about to do during the prep gap — across providers, no Deep-mode regression, no shared-path fork (SC#10).
  2. The tool-card header shows the actual provider's logo per-provider, replacing the generic brand-pulse "spot" avatar (CTC-01).
  3. The tool card carries a unified content/layout across ALL providers — the single canonical, complete surface for live run info (status, elapsed, step/file counts, description), with no per-provider gaps (CTC-02; provider-docs-first / SC#10 — verified uniform before relying on it).
  4. The redundant sticky elapsed timer above the composer (`ChatArea.tsx` 076.1 D-03; today inconsistent across providers) is removed once CTC-02 holds, reclaiming chat-area space (CTC-03).
  5. Long user prompts collapse to a clamped preview with a "Read more" expander instead of rendering full-height (CTC-04).
  6. The unified surface is sketch-approved (G-2) before planning — the operator-approved mockup is the acceptance bar.

**Plans**: 6 plans

- [x] 128-01-PLAN.md — Install @lobehub/icons (supply-chain checkpoint) [D-08]
- [x] 128-02-PLAN.md — CTC-04 long-prompt clamp + gradient fade + Read-more (independent) [D-03]
- [x] 128-03-PLAN.md — providerLogo.tsx shared helper (logo map + preparingDescription) + Wave-0 unit tests [D-05]
- [x] 128-04-PLAN.md — CTC-01 RunCard logo + TDP-02 ToolCallPanel description = the unified card (CTC-02) [D-01/D-04]
- [x] 128-05-PLAN.md — D-06 LIVE native-7+OpenRouter cross-provider scoreboard (operator-run) [D-06]
- [x] 128-06-PLAN.md — CTC-03 StickyTimerBar deletion (LAST, gated on the D-06 proof) [D-02/D-07]

**UI hint**: yes

#### Phase 129: MiniMax/OpenRouter Arg Repair

> **STRETCH-origin** — promoted to active 2026-06-26 after v3.1 CORE (120–124) shipped clean; selected as a highest-value STRETCH (the only one closing a live open bug).

**Goal**: Broader provider robustness — MiniMax malformed tool-args are repaired at the adapter boundary, and OpenRouter requests set `require_parameters` so a wider set of routed providers honor the tool schema.
**Depends on**: Phase 122 (extends the cross-provider trust cluster at the gateway/adapter boundary); CORE complete (gate lifted)
**Requirements**: MP-04 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. A MiniMax malformed-args response is repaired at the adapter boundary so the tool call still dispatches instead of failing (closes the `minimax-m3-invalid-tool-args-400` class).
  2. OpenRouter requests carry `require_parameters`, and the change improves tool-schema honoring without regressing other providers (SC#10), with provider handling staying at the adapter boundary (no shared-path fork).

**Plans**: 3 plans

- [ ] 129-01-PLAN.md — OpenRouter `require_parameters` wired into the quality strategy (D-02) + unit test
- [ ] 129-02-PLAN.md — MiniMax-gated arg-validity guard + bounded re-ask + recovered signal / honest-fail (D-01/D-03); folds BUG-260607-03 + unit tests
- [ ] 129-03-PLAN.md — SC#10 4-axis live cross-provider scoreboard (authored in VALIDATION.md + operator-run)

#### Phase 130: template_input Resolver Run-Scope

**Goal**: Defense-in-depth for the collision — the `template_input` resolver is run-scoped too, so the `render_template` path can't re-introduce a cross-run leak alongside the COLL-01 harvest fix.
**Depends on**: Phase 120 (pairs with COLL-01 on the same collision/harvest surface); gated behind CORE completion
**Requirements**: COLL-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The `template_input` resolver only resolves inputs scoped to the current run — a prior run's template inputs in the shared workspace are never picked up by a later run's `render_template`.
  2. The render_template path produces the same output it did before for in-scope inputs (no regression on the happy path).

**Plans**: TBD

#### Phase 131: Non-Python Skill-Script Honesty

**Goal**: A user who imports or runs a market skill that bundles a non-Python script the Python-only sandbox can't execute (e.g. `.js`) gets an honest, specific signal instead of a silent/confusing failure — closing the trust gap from the 2026-05-31 JS-skill-import incident (SEED-044 Layer 1). This is the honesty precursor to v3.2's DISC-01 (the full Node-execution capability); it is purely additive and stays OFF the COLL-01 sandbox-injection seam.
**Depends on**: Nothing hard; sequence after Phase 120 only to avoid touching the COLL-01 harvest/execution seam concurrently. Gated behind CORE completion. Lightweight (G-3-adjacent — import-boundary detection + an execution pre-check + message; no Node runtime, no image rebuild, no shared-path fork).
**Requirements**: SRH-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. Importing a skill that bundles a non-Python script (e.g. `.js`) still succeeds, and the user sees an honest message that the skill includes a step the sandbox can't run yet while its instructions still work.
  2. When the agent would run a non-Python skill script, it fails cleanly with a specific message instead of silently running JS as Python and dying on a Python `SyntaxError`.
  3. (Optional) `read_skill_file` can return a bundled `.js` as reference text so the model can read/reason about it, without implying it can be executed.

**Plans**: TBD
**Note**: Real multi-language execution (Node in the image + language routing) is explicitly NOT this phase — that's v3.2 DISC-01, which must sequence after COLL-01.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 120. Collision Fix + Context Isolation | 3/3 | Complete | 2026-06-22 |
| 121. One Front Door for Workflows (IA) | 2/2 | Complete | 2026-06-23 |
| 122. Cross-Provider Trust & Honesty Parity | 4/4 | Complete | 2026-06-23 |
| 123. Skill Triggering Quality | 6/6 | Complete (secure 29/29 · validate 12/12 · verify 12/12 + SC#10 4-axis UAT 4/4) | 2026-06-26 |
| 123.1 (INSERTED). Skill Trigger Tuner — Design Fidelity & UX Polish | 10/10 | Complete (verify 22/22 + UAT 8/8 · secure 34/34 · validate 9/9) | 2026-06-25 |
| 124. Workflow Studio UX — Soul + Strict↔Loose | 3/3 | Complete (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 · CORE complete) | 2026-06-26 |
| 125 (STRETCH). Self-Improve Proposer (description-only) | 0/? | Gated (behind CORE) | - |
| 126 (STRETCH). Smart-Dispatch Relevance Pre-Filter | 0/? | Gated (behind CORE) | - |
| 127 (STRETCH). Gauntlet Pip-Strip + Quiet Idle Cards | 3/3 | Code-verified (11/11 truths); manual UAT pending | 2026-06-27 |
| 128 (STRETCH). Chat Tool-Card Unification + Chat-Area Reclaim | 6/6 | Complete (verify 5/6 code truths · D-06 scoreboard PARTIAL — logos confirmed live both themes, exhaustive sweep deferred · 3 live-UAT carried · white-chip + lmstudio logo fixes) | 2026-06-27 |
| 129 (STRETCH). MiniMax/OpenRouter Arg Repair | 0/? | Gated (behind CORE) | - |
| 130 (STRETCH). template_input Resolver Run-Scope | 0/? | Gated (behind CORE) | - |
| 131 (STRETCH). Non-Python Skill-Script Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.1):**

- **G-2 sketch-first** on Phase 121 (IA-01), Phase 124 (WUX-01/02), Phase 127 (WUX-03), Phase 128 (CTC-01..04 — reframed 2026-06-27 from a non-visual TDP-02 into a visual chat-surface bundle) — all live UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names the workflow run surface, the Workflows page, the phase timeline, and the composer.
- **G-5 hot files:** `backend/app/api/threads.py` (firing → extraction due — do NOT grow it; 120/121 touch its thread/composer surface), `context_window.py`/`agent_loop.py` trim path (CTX-01 origin filter in `_reconstruct_history`, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **SC#10 cross-provider** is an EVAL axis here (MP-03), not just manual UAT — flagged on every phase touching streaming / agent loop / provider routing / UI state (120, 121, 122, 123, 124, and the dependent STRETCH phases).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

---

## v3.0 Document Management — ✅ SHIPPED 2026-06-21

Full detail archived → **`.planning/milestones/v3.0-ROADMAP.md`** · requirements → **`.planning/milestones/v3.0-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

11 phases (110, 111, 111.1, 112–119; incl. inserted embeddings phase 111.1), 46 plans, shipped + validated — **every phase passed verify-work + secure-phase + validate-phase** (live cross-provider UAT on the agent-tool / upload-path phases; no formal milestone audit). Turned the product's incidental document handling into a first-class, metadata-driven surface (M-Files Tier A): user-defined custom metadata with per-field confidence + audited manual override, configurable multi-provider embeddings (retires the OpenAI SPOF), metadata-driven "virtual folders" (a closed-registry filter-AST → parameterized-jsonb compiler + a no-DSL builder + an agent tool), typed document relationships (a leak-safe share-don't-fork core + panel + agent tool), suggest-then-confirm auto-classification, and a light governance-health view. 24/24 functional requirements delivered; `threads.py` untouched all milestone (G-5); near-zero new deps.

**Next:** v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers (active above; decided scope in `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`).

---

## v2.9 Workflow Studio — ✅ SHIPPED 2026-06-15

Full detail archived → **`.planning/milestones/v2.9-ROADMAP.md`** · requirements → **`.planning/milestones/v2.9-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

CORE phases 097–104 (9 phases incl. inserted 101.1, 57 plans) shipped + validated — every CORE phase passed verify-work + secure-phase + live cross-provider UAT. Turned the v2.8 harness into an authorable capability: project/scope binding + server-side KB governance, workflow↔skill composition, ephemeral template upload + guaranteed cited template-fill with integrity gates, a reusable validation-gate library + an output-quality judge **hard-wall**, a Workflows page with NL authoring + read-only graph + 8-stage publish gauntlet, and a PM flagship content pack on the generic primitives.

**STRETCH 105–109 deferred to backlog** (never started — roadmap gated them on "ship only if CORE lands clean and budget remains"): SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier). They roll forward as next-milestone candidates.

---

## Shipped Milestones

<details>
<summary>v3.2 Skill Eval Studio + Self-Improving (Phases 132-145) — SHIPPED 2026-07-10</summary>

CORE 132-137 (+ inserts 134.1, 137.1, 137.2): eval test-case persistence + immutable versions + with-skill-vs-without runner + honest per-provider verdicts + ratings + self-improve loop (SI-01) + publish gate + Evals panel + eval production-clean + built-in skill-creator. STRETCH shipped: 138 Run-End Honesty · 139 Self-Improve Proposer (description-only) · 140 Smart-Dispatch Relevance Pre-Filter · 141 template_input Resolver Run-Scope · 142 Non-Python Skill-Script Honesty · 143 Starter Workflow Library · 145 Run-Lifecycle Honesty + threads.py Extraction (FND-01). STRETCH deferred: 144 (FILE-01) → v3.3. 81 plans total. Full details: `.planning/milestones/v3.2-ROADMAP.md`.

- [x] Phase 132: Skill Versioning + Eval Test-Case Persistence (3/3 plans) — completed 2026-06-30
- [x] Phase 133: Eval Runner — With-Skill vs Without-Skill (5/5 plans) — completed 2026-06-30
- [x] Phase 134: Eval Results, Honest Verdict + Ratings (4/4 plans) — completed 2026-07-02
- [x] Phase 134.1: Evals Run Silently (bug fix — inserted during 134 UAT) (1/1 plans) — completed 2026-07-02
- [x] Phase 135: Self-Improvement Loop (SI-01) (9/9 plans) — completed 2026-07-02
- [x] Phase 136: Skill Publish Gate (GATE-01) (4/4 plans) — completed 2026-07-03
- [x] Phase 137: Skill Evals Panel UI (PANEL-01) (7/7 plans) — completed 2026-07-04
- [x] Phase 137.1: Skill Eval Production-Clean (10/10 plans) — completed 2026-07-04
- [x] Phase 137.2: Skill Creator Reborn — Built-in + Protected (4/4 plans) — completed 2026-07-04
- [x] Phase 138: Run-End Honesty (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 139: Self-Improve Proposer — Description-Only (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) (5/5 plans) — completed 2026-07-07
- [x] Phase 141: template_input Resolver Run-Scope (STRETCH) (3/3 plans) — completed 2026-07-07
- [x] Phase 142: Non-Python Skill-Script Honesty (STRETCH) (5/5 plans) — completed 2026-07-08
- [x] Phase 143: Starter Workflow Library (STRETCH) (5/5 plans; core UAT proven live, A1+empty-folder deferred) — completed 2026-07-10
- [x] Phase 145: Run-Lifecycle Honesty + threads.py Extraction (STRETCH · FOUNDATION) (6/6 plans; SC#10 UAT 6/6) — completed 2026-07-10
- [ ] Phase 144: Agent-Driven Skill File Attachment (FILE-01) — DEFERRED → v3.3 (not executed)

</details>

<details>
<summary>v3.1 Workflow &amp; Skill Studio — Trust, Clarity &amp; Triggers (Phases 120-129) — SHIPPED 2026-06-28</summary>

CORE (6 phases + inserted 123.1): 120 Collision Fix + Context Isolation · 121 One Front Door · 122 Cross-Provider Trust & Honesty · 123 Skill Triggering Quality · 123.1 Trigger Tuner UX Polish · 124 Workflow Studio UX Soul + Strict↔Loose. STRETCH shipped: 127 Gauntlet Pip-Strip (code-verified/UAT partial) · 128 Chat Tool-Card Unification + Provider Logos · 129 MiniMax/OpenRouter Arg Repair. STRETCH deferred: 125/126/130/131. 40 plans total. Full details: `.planning/milestones/v3.1-ROADMAP.md`.

- [x] Phase 120: Collision Fix + Context Isolation (3/3 plans) — completed 2026-06-22
- [x] Phase 121: One Front Door for Workflows (IA) (2/2 plans) — completed 2026-06-23
- [x] Phase 122: Cross-Provider Trust & Honesty Parity (4/4 plans) — completed 2026-06-23
- [x] Phase 123: Skill Triggering Quality (6/6 plans) — completed 2026-06-26
- [x] Phase 123.1: Skill Trigger Tuner — Design Fidelity & UX Polish (10/10 plans) — completed 2026-06-25
- [x] Phase 124: Workflow Studio UX — Soul + Strict↔Loose (3/3 plans) — completed 2026-06-26
- [x] Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards (3/3 plans) — code-verified 2026-06-27
- [x] Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim (6/6 plans) — completed 2026-06-27
- [x] Phase 129: MiniMax/OpenRouter Arg Repair (3/3 plans) — completed 2026-06-27

</details>

<details>
<summary>v3.0 Document Management (Phases 110-119) -- SHIPPED 2026-06-21</summary>

- [x] Phase 110: DM Foundations (2/2 plans) -- completed 2026-06-15
- [x] Phase 111: Metadata Enrichment — Extraction Backend (5/5 plans) -- completed 2026-06-16
- [x] Phase 111.1: Configurable / Multi-Provider Embeddings (6/6 plans) -- completed 2026-06-17
- [x] Phase 112: Metadata Enrichment — Detail Panel + Manual Edit (4/4 plans) -- completed 2026-06-18
- [x] Phase 113: Virtual Folders — Filter Compiler + Equality (Backend) (3/3 plans) -- completed 2026-06-18
- [x] Phase 114: Virtual Folders — Range/Date + Builder + Sidebar (6/6 plans) -- completed 2026-06-19
- [x] Phase 115: Virtual Folders — Agent Tool (3/3 plans) -- completed 2026-06-20
- [x] Phase 116: Document Relationships — Backend + Agent Tool (5/5 plans) -- completed 2026-06-20
- [x] Phase 117: Document Relationships — Panel UI (4/4 plans) -- completed 2026-06-20
- [x] Phase 118: Auto-Classification (6/6 plans) -- completed 2026-06-21
- [x] Phase 119: Document Governance Health (2/2 plans) -- completed 2026-06-21

</details>

<details>
<summary>v2.9 Workflow Studio (Phases 097-104 CORE) -- SHIPPED 2026-06-15</summary>

- [x] Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel (5/5 plans) -- completed 2026-06-08
- [x] Phase 098: Project Binding + Server-Side KB Scope Governance (5/5 plans) -- completed 2026-06-09
- [x] Phase 099: Workflow ↔ Skill Composition (6/6 plans) -- completed 2026-06-10
- [x] Phase 100: Ephemeral Template Upload (6/6 plans) -- completed 2026-06-10
- [x] Phase 101: Template-Fill + Integrity Validation (5/5 plans, via 101.1) -- completed 2026-06-12
- [x] Phase 101.1: Guaranteed Structured Emission Layer (10/10 plans; verify-work 19/19 + secure 36/36) -- completed 2026-06-12
- [x] Phase 102: Reusable Validation-Gate Library + Output-Quality Gate (9/9 plans; verify-work 7/7 + secure 34/34) -- completed 2026-06-13
- [x] Phase 103: Workflows Page + Authoring API + NL Authoring (6/6 plans; secured 32 threats/0 open) -- completed 2026-06-14
- [x] Phase 104: PM Flagship Content Pack (3/3 plans; secured 15/0 + nyquist + live UAT 5/5) -- completed 2026-06-15

STRETCH (deferred to backlog, never started): 105 Scheduled Triggers + Budget Caps · 106 Citation-Traceable Grid Renderer · 107 Per-Run Provenance Receipt · 108 Plugin Contract Lock · 109 Operator/Admin Role Tier.

</details>

<details>
<summary>v1.0 Knowledge Base Explorer (Phases 1-8) -- SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) -- completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) -- completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) -- completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) -- completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) -- completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) -- completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) -- completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) -- completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Agent Skills & Code Execution (Phases 9-17) -- SHIPPED 2026-04-04</summary>

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Stability & RAG Correctness (Phases 18-25) -- SHIPPED 2026-04-11</summary>

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v2.2 Trust & Compliance (Phases 26-32) -- SHIPPED 2026-04-16</summary>

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Memory, Multimodal & Experience (Phases 33-43) -- SHIPPED 2026-04-19</summary>

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>v2.4 Stability, Polish & UX Fixes (Phases 44-57) -- SHIPPED 2026-04-30</summary>

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>v2.5 Deployment Strategy (Phases 058-067.5) -- SHIPPED 2026-05-09</summary>

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068-082) -- SHIPPED 2026-05-27</summary>

35 phases (068-082 including inserts), 91 plans complete. See `.planning/milestones/v2.6-phases/` for archived phase directories and `.planning/MILESTONES.md` for the full close-out narrative.

</details>

<details>
<summary>v2.7 Agent Workspace & Panel (Phases 083-088) -- SHIPPED 2026-05-30</summary>

6 phases (083-088), 28 plans, 50 tasks complete. Per-thread workspace filesystem (write/read/list/delete/version/diff, hybrid inline/Storage), 3 new agent tools (`write_todos`, `task` sub-agents, `ask_user` pause/resume via Redis pub/sub), the right-side collapsible workspace panel (todos · file browser · version diff · ask_user seam), and WCAG 2.1 AA across all panel surfaces. Full phase details: `.planning/milestones/v2.7-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes (3/3 plans) -- completed 2026-05-27
- [x] Phase 084: Workspace Filesystem Backend (5/5 plans) -- completed 2026-05-28
- [x] Phase 085: New LLM Tools (5/5 plans) -- completed 2026-05-28
- [x] Phase 086: StreamsProvider Extension + Panel Hooks (2/2 plans) -- completed 2026-05-29
- [x] Phase 087: Panel UI (8/8 plans) -- completed 2026-05-29
- [x] Phase 088: Cross-Cutting Verification + Accessibility (5/5 plans) -- completed 2026-05-30

</details>

<details>
<summary>v2.8 Harness Engine & Workflow Mode (Phases 089-096) -- SHIPPED 2026-06-07</summary>

10 phases (089-096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1), 67 plans complete. A deterministic, auditable workflow runtime -- locked ordered phases + dispatcher-enforced per-phase tool whitelists + validation gates with bounded retry + Postgres-resumable phase state, plus a per-thread Deep/Harness dual-mode toggle and a live WCAG 2.1 AA phase-timeline in the workspace panel. The harness is ~80% composition of shipped primitives with zero new deps; Deep Mode stayed byte-identical (the red line). Mid-milestone rescope (discuss-093) inserted 092.5 (provider-gateway extraction) + 095.1 (cross-provider run honesty). Full details: `.planning/milestones/v2.8-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT (4/4 plans) -- completed 2026-05-30
- [x] Phase 090: Harness Schema + RLS + Config Models (3/3 plans) -- completed 2026-05-31
- [x] Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist (8/8 plans) -- completed 2026-05-31
- [x] Phase 092: Dual-Mode Wiring + Continue Button (7/7 plans) -- completed 2026-06-01
- [x] Phase 092.5: Provider Gateway Extraction (6/6 plans) -- completed 2026-06-01
- [x] Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening (9/9 plans) -- completed 2026-06-03
- [x] Phase 094: Workflow Legibility + Mode Clarity (5/5 plans) -- completed 2026-06-04
- [x] Phase 095: Chat Tool-Card Unification (9/9 plans) -- completed 2026-06-06
- [x] Phase 095.1: Cross-Provider Run Honesty & Workspace Parity (7/7 plans) -- completed 2026-06-06
- [x] Phase 096: Eval Harness + Cross-Provider Verification + Concurrency (9/9 plans) -- completed 2026-06-07

</details>

---

*Milestones v1.0–v3.1 shipped and archived under `.planning/milestones/`. **Next milestone: v3.2** — run `/gsd:new-milestone` to define scope. Re-sequenced PRD roadmap: see `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 + v3.1 STRETCH 125/126/130/131 remain backlog carry-forwards.*
