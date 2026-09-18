---
seed_id: SEED-012
title: Admin / Operator UI Completeness — control everything from UI, simplify the fallback
created: 2026-05-09
planted_during: v2.5 close-out
status: planted
priority: high
relates_to:
  - SEED-003 (Deployment Flexibility & Install/Config UX) — install-time / first-run UX
  - SEED-004 (Org / Department / Role Multi-Tenancy) — RBAC data model + per-user settings; this seed is the operator-side of admin (system-level levers, not user-level)
  - PROJECT.md "Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only" — current rule that this seed extends from "rule" into "shipped surface"
  - Memory: project_target_scale.md (organizational scale, scale-ready defaults)
  - Memory: project_settings_design_guidance.md (Settings page redesign deferred to Skill Studio milestone)
  - SEED-005 (Enhanced Document Structure / next milestone) — ships schema changes the operator must apply through whatever migration-apply surface v3.1 lands
  - SEED-024 (Settings Unification) — where the operator shell nests
  - SEED-073 (Per-model cost-rate registry + token→USD) — feeds the operator cost/observability dashboard (§2/§3)
  - SEED-074 (Workflow/harness + sub-agent token-usage rollup) — feeds the operator cost/observability dashboard (§2/§3)
  - SEED-075 (Backup, Restore & Disaster Recovery) — natural home for the migration snapshot/rollback contract; co-design migration_state_snapshots
  - SEED-078 (Unified runtime feature-flag / kill-switch / maintenance-mode) — operator lever to gate a migration apply (maintenance-mode before applying)
  - SEED-079 (PII detection / redaction / DLP) — further system-level operator lever under /admin
  - SEED-080 (Entitlement / feature-gating primitive) — further system-level operator lever under /admin
trigger_when:
  - Any user (especially a non-developer operator) reports having to "ssh into the server" / "edit a file" / "paste SQL" to do something operational
  - Planning a v3.x or later milestone scoped to "admin", "operator", "platform UX", "self-service", or "tenant management"
  - Phase 064 (Validation Harness) is revisited — this seed wants the validation-runner UI surface that 064 deferred
  - Onboarding a non-developer co-maintainer or first paying customer's IT operator
  - Any "configure once at install, then it just works" promise gets made
  - Cross-trigger from SEED-003 milestone planning — install/config UX naturally extends into runtime operator UX
trigger_surfaces:
  - "admin"
surface: Agentic-RAG
---

# SEED-012: Admin / Operator UI Completeness

## The principle (user-stated 2026-05-09)

> "An admin user who can control everything from UI, and in case something is outside the UI, we should simplify and maintain flexibility."

This is a meta-principle, not a feature: **every operationally-relevant lever the admin / operator needs should have a UI surface; where it doesn't, the fallback (env var, config file, SQL editor) should be sane, well-documented, and not punish the operator with cryptic file paths or fragile shell commands.**

## Why this matters now (audit of the current admin surface)

The app already has a `SettingsPage.tsx` (`frontend/src/pages/SettingsPage.tsx`) covering **user-level** settings: LLM model, search config, chat preferences, memory, audit visibility (per memory `project_settings_design_guidance.md`). What's missing is the **operator-level** UI surface — the levers that today require shell, SQL editor, or `.env` edit:

**Operational levers currently outside the UI** (audited at v2.5 close):
- **Database migrations** — must be hand-pasted into Supabase SQL editor (per CLAUDE.md). No "apply pending migrations" button, no preview-diff, no rollback affordance.
- **Backend env vars** — `REDIS_URL`, `SANDBOX_ENABLED`, `LLM_CALL_TIMEOUT_OVERRIDES`, `OPENROUTER_API_KEY`, `SUPABASE_*` keys, etc. all in `backend/.env`. No "rotate API key" UI, no "validate connection" health probe, no "what env vars does this deployment expect" reference.
- **Provider key management** — Anthropic / OpenAI / OpenRouter / Google keys live in env. No per-org or per-user override UI; no "which provider is healthy right now" visible status; no rate-limit / quota surface.
- **MODEL_CAPABILITIES registry** — adding a new model requires editing `backend/app/config.py`. No UI to enable/disable models, set per-model `max_tokens` cap (cf. SEED-009 claude-haiku case), set `default_temperature`, mark a model deprecated.
- **Sandbox config** — `SANDBOX_ENABLED`, Docker daemon health, `llm-sandbox` image version. No UI to verify sandbox is healthy, restart it, or see recent execution failures.
- **User management** — creating/disabling users currently goes through Supabase Auth dashboard directly. No in-app admin "users list" with disable/role-assign affordances.
- **Migration / schema state** — no "what version is this DB at?" surface; no "regenerate full-schema.sql from live DB" button (`scripts/regenerate-full-schema.sh` is a shell script today).
- **Worker / Redis / Supabase health** — `/health` returns `{status: ok, redis: ok}` but there's no operator-facing dashboard rendering it; you have to curl.
- **Audit log export** — exists per-user (Phase 067 v2.2 F-06) but no org-wide / admin-wide aggregator UI.
- **Background runs lifecycle** — `runs:active` ZSET has the data; the Knowledge Health Dashboard renders some of it; no "kill this stuck run", "reschedule this run", "see all active runs across all users (admin view)".

This list is the work. None of it is conceptually new — every lever already exists somewhere — but exposing it cleanly turns a developer-only codebase into an operator-friendly product.

## Why this is a separate seed from SEED-003 and SEED-004

- **SEED-003 (Deployment Flexibility)** owns *install-time* and *first-run* UX: "how do I get this running" through "the app is now deployed". This seed picks up where SEED-003 ends: "the app is deployed; how does the operator run it day-to-day without shell access?"
- **SEED-004 (Org / Department / Role)** owns *per-user* and *per-org* admin UX: tenant settings, dept-scoped skills, role-based visibility. This seed is *system-level* admin: deployment-wide levers, model registry, migration state, observability — concerns that exist even in a single-org install.

Strong overlap with both. Plan the three together when any of the three triggers fire — but each can ship independently if the others stall.

## Scope (when triggered)

This is genuinely cross-cutting and will sprawl if scoped naively. Suggested chunking:

1. **Operator role + admin shell** *(prerequisite — small)*
   - Define an `operator` role distinct from `user`. Could be a single hard-coded admin email (v1) or a `user_metadata.role = 'operator'` flag (v2; pairs with SEED-004 RBAC).
   - Ship a sidebar / route for `/admin` visible only to operators.
   - All subsequent surfaces nest under `/admin/...`.

2. **Health & observability dashboard** *(small, high signal)*
   - Render `/health` (Redis OK, Supabase OK, sandbox OK) as a live dashboard.
   - Active runs (`runs:active` ZSET) with thread / user / model / elapsed / "Kill" affordance.
   - Recent errors from `runs.error` column with filter.
   - LangSmith deep-link per run (project already uses LangSmith — surface it).
   - Worker / event-loop saturation (paired with SEED-001 instrumentation).

3. **Provider & model management** *(medium)*
   - Provider list (OpenAI / Anthropic / OpenRouter / Google) with per-provider connection-test button.
   - Per-provider rate-limit + quota awareness (where APIs expose it).
   - Model registry editor: enable / disable, override `max_tokens` cap (cf. SEED-009), override `default_temperature`, mark deprecated.
   - Provider key rotation UI (writes to a secrets store, not back to `.env` — this needs a secrets-store decision; see SEED-003 item on secrets management).

4. **User management** *(medium)*
   - Users list with last-active, disable, role-assign (pairs with SEED-004 once that lands).
   - Audit log filtered to "all users" view (today only per-user).
   - "Sign in as user" affordance for support (with audit trail).

5. **Migrations & schema state** *(medium-high — touches deployment flow)*
   - "Pending migrations" list with diff preview.
   - "Apply migration" button that pastes into the live DB via a secured backend route (or generates the SQL for the operator to paste — depends on Supabase deployment shape).
   - "Regenerate full-schema.sql" button (replaces `scripts/regenerate-full-schema.sh`).
   - Schema-version banner ("DB is at 067; latest migration in repo is 069 — 2 pending").

6. **Sandbox operations** *(small-medium)*
   - Sandbox health probe (Docker daemon up? `llm-sandbox` image present? recent failures?).
   - "Restart sandbox" affordance.
   - Sandbox config read-write (memory limits, network policy, allowed-language list).

7. **Settings UI redesign** *(coordinate with memory `project_settings_design_guidance.md`)*
   - The deferred Settings page redesign already exists as a memory note ("Settings page layout needs design review before Phase 42; … full redesign deferred to Skill Studio milestone"). When redesigning, allocate UX space for the operator-shell at the same time so the user-vs-admin separation is clean from v1 of the redesign.

## Fallback principle (when UI is genuinely impractical)

For levers we choose NOT to put in the UI (e.g., extreme one-off ops, security-sensitive, or cost-prohibitive to build a UI for):

- **Document them in one place** — a single `OPERATOR.md` (paired with `supabase/SETUP.md` and `REDIS-SETUP.md`) listing every shell-accessible lever, its purpose, the safe and unsafe paths, and the next-best UI surface to extend if demand grows.
- **Wrap the dangerous ones in a script** — like the existing `scripts/regenerate-full-schema.sh`. Operators read one entry point, not stitch together raw commands.
- **Sanity-default everything** — the env-var fallback path should never require operator decisions to ship a working install (defaults work; overrides are for tuning).

This honors "simplify and maintain flexibility" — anything outside the UI is still simple to use and still flexible enough to handle edge cases without re-architecture.

## Cost estimate (very rough)

Full scope is probably a 4–8 phase milestone. Phasing suggestion if shipped incrementally:
- **Phase 1**: Operator role + admin shell + health dashboard — ~1 week. Ships immediate observability win.
- **Phase 2**: Provider + model registry UI — ~1.5 weeks. Closes SEED-009 + reduces "edit `config.py`" friction.
- **Phase 3**: User management + audit (org-wide) — ~1 week. Pairs naturally with SEED-004 if it ships first.
- **Phase 4**: Migrations + schema state UI — ~2 weeks. Highest-value, highest-complexity (touches deployment flow).
- **Phase 5**: Sandbox ops + Settings redesign — ~1 week. Tail polish.

## Reference paths (current state, for future planner)

- `frontend/src/pages/SettingsPage.tsx` — current user-level settings page
- `backend/app/api/settings.py` — settings API (per-user only today)
- `backend/app/config.py` — `MODEL_CAPABILITIES` registry, env-var loading
- `backend/.env.example` — full operator-relevant env-var inventory
- `supabase/SETUP.md`, `REDIS-SETUP.md` — current operator runbooks (to merge / link from `OPERATOR.md`)
- `scripts/regenerate-full-schema.sh` — example of "wrapped dangerous lever"
- `backend/app/api/runs.py` — already exposes per-run cancel; foundation for "kill stuck run" admin affordance

## Strengthen — 2026-06-10 alignment sweep (Phase 101, workflow wf_13ed5033)

The §5 "Migrations & schema state" chunk above leaves the *apply mechanism* as an unresolved fork — line 85 hedges between "an 'Apply migration' button that pastes into the live DB via a secured backend route" **or** "generates the SQL for the operator to paste — depends on Supabase deployment shape." That hedge is the seam this sweep wants to harden into a falsifiable requirement, because it is the single biggest gap between the current dev-only discipline and the operator-friendly product this seed promises.

**The core mismatch.** Today's discipline — paste each `supabase/migrations/NNN_*.sql` into the Supabase SQL editor, then run `scripts/regenerate-full-schema.sh`, and *never* `supabase db push` / `db reset` (CLAUDE.md; line 36; line 86) — is a **developer** workflow that assumes shell + SQL-editor access. A non-developer production operator has neither. So the dev path does not translate, and the gap is exactly the friction that SEED-003's deployment-flexibility thesis (and the v3.1 milestone built on it) exists to remove. A "configure once, then it just works" promise (this seed's own trigger, line 19) is hollow if applying schema changes still demands the operator open a SQL console.

**Two deployment shapes, two different safe answers — and they must be enumerated, not hedged.** The fork is not one decision; it is two distinct operator personas with two distinct safe paths:
- **Co-tenant SaaS operator** — the operator does NOT own the database; the platform vendor runs migrations centrally. The "Apply migration" button must NOT exist per-tenant (a tenant-triggered DDL apply is a cross-tenant blast-radius and data-isolation hazard, see below). The operator surface here is *visibility* (schema-version banner, "your tenant is at 067, platform latest is 069") and *gating*, never *execution*.
- **Dedicated / on-prem operator** — the operator owns the DB and legitimately needs to apply pending migrations without a shell. Here the secured-backend-route apply path is appropriate, but only with the rollback/snapshot contract below.

**Falsifiable v3.1 requirement (what this seed now asks v3.1 to answer concretely):**
1. For each persona above, *how does the operator apply a pending migration safely* without shell/SQL-editor access — which surface, which auth gate, which preview-diff, which dry-run?
2. *What is the rollback / snapshot contract?* The reference note in memory (`project_098_uat_timeline_fix.md` lineage) and the broader audit-trail tables imply a `migration_state_snapshots` concept, but its rollback semantics are **undefined** — there is no answer to "the apply half-failed; what state am I in and how do I get back?" v3.1 must define: is a pre-apply snapshot taken automatically, is rollback transactional-per-migration or restore-from-snapshot, and who can trigger a rollback.

**Cross-seam to v3.2 (RLS rewrite) — why an unsafe apply path is a security hazard, not just an inconvenience.** v3.2's planned Row-Level-Security rewrite across the 18 user-data tables means a migration apply path that runs operator-supplied or mis-sequenced DDL is a **data-isolation hazard**, not merely an operational annoyance: a botched apply can drop or weaken an RLS policy and silently expose one tenant's rows to another. This raises the bar on requirement #1 — the apply mechanism must be incapable of leaving RLS in a partially-applied state. This couples directly to SEED-004 (org multi-tenancy: the RLS/tenant data model) and to SEED-005 (enhanced document structure, the *next* milestone, which itself ships schema changes the operator will eventually have to apply through whatever surface v3.1 lands).

**Cross-links opened by this sweep.** This apply-path gap also touches the new operator-surface seeds planted this batch — they are levers that, like migrations, currently live outside any operator UI: SEED-073 (per-model cost-rate registry + token→USD) and SEED-074 (workflow/harness + sub-agent token-usage rollup) feed the cost/observability dashboard in §2/§3; SEED-075 (Backup, Restore & Disaster Recovery) is the natural home for the snapshot/rollback contract this section demands and should co-design `migration_state_snapshots` with it; SEED-078 (unified runtime feature-flag / kill-switch / maintenance-mode) is the operator lever that should *gate* a migration apply (flip to maintenance-mode before applying); SEED-080 (entitlement / feature-gating) and SEED-079 (PII detection / DLP) are further system-level levers that belong under `/admin`. Adjacent existing seeds remain in scope: SEED-024 (settings unification — where the operator shell nests), SEED-001 (scale readiness), SEED-048 (embeddings SPOF), SEED-053 (sub-agent events surfaced up), SEED-061/062/065/069/071/036/055 (operational observability and degradation levers the dashboard renders).
