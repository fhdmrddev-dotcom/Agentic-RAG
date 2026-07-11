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
- 🚧 **v3.3 Operator UX** — Phases 146-158 (CORE 146-155 + STRETCH 156-158) — IN PROGRESS (started 2026-07-10). Operator/admin tier + dynamic model/secrets management + workflow file-inputs + Glean/Beam-informed trust/friendliness UX. Roadmap created 2026-07-10; 19 reqs (16 CORE + 3 STRETCH), 100% mapped.
- 📋 **v3.4 Multi-tenancy** → **v3.5 Open Platform (API/MCP)** → **v3.6 Automations** — the enterprise-GTM track (shifted down one slot 2026-06-21 by the Skill-Studio split; brief filenames keep old numbers). ⚠ Multi-tenancy (one-way RLS door) now 3 slots out — the GTM track jumps the queue if a paying customer appears. **Authoritative map: `PRDs/SEQUENCE.md`.**

---

## v3.3 Operator UX — 🚧 IN PROGRESS (started 2026-07-10)

**Numbering:** continues from v3.2's last phase (145) → **CORE Phases 146-155**, then **STRETCH Phases 156-158** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 precedent). *Phase 144 is BURNED — it held the deferred v3.2 FILE-01 phase (never executed, archived to `.planning/milestones/v3.2-phases/` with a DEFERRED label); FILE-01 gets a fresh number in v3.3 (Phase 151). 144/145 are never reused.*

**Goal:** Make the platform operable and configurable by a non-developer admin from the UI — while closing the workflow/skill file-input gaps deferred from v3.2 and aligning the everyday UX to what Glean/Beam do well (simple, accurate, plain-language).

**Scope source:** `.planning/REQUIREMENTS.md` (19 requirements — 16 CORE + 3 STRETCH). Research base: `.planning/research/SUMMARY.md` (4-dimension + a mandatory Glean/Beam competitor study; supersedes the stale `PRDs/v3.2-operator-ux.md` internals — D-PRD business decisions hold). Authoritative version map: `PRDs/SEQUENCE.md`.

**Red lines (every phase):**

- **No RLS backstop on `/admin`** — the backend runs on the Supabase service-role key, so every operator route enforces isolation in application code (a missing `WHERE user_id =` filter is a full-tenant leak, not a scoped one). `require_operator` is default-deny at router level; non-operators get **404** (non-discoverable), and every `/admin` route carries a 404-regression test for a normal user's JWT.
- **Operator role is a one-way door vs the v3.4 multi-tenancy RLS rewrite** — `operator_users` is a system-level, org-agnostic principal (NOT a JWT claim, NOT `is_admin`); ship `org_id` stub columns where cheap, never schema shapes that fight the rewrite.
- **Provenance→engine boundary holds** — a run-time uploaded template is provenance-stamped (`kind='template_input'`) and structurally barred from the Jinja/`docxtpl` engine (SSTI); library-promotion is never implicit.
- **Discovery proposes, humans confirm** — live model discovery never auto-enables a capability the provider's `/models` endpoint didn't return (only 2 of 8 providers return capability metadata).
- **Shared path never forks** — Deep Mode stays byte-identical; provider differences stay at the gateway/adapter boundary (D-14).

### Phase Table (CORE) — Phases 146-155

| Phase | Name | Goal (one-line) | Requirements | SC# | Flags |
|-------|------|-----------------|--------------|-----|-------|
| 146 | Operator Foundation | A designated operator reaches a gated `/admin` surface no ordinary user can discover, and every operator action is recorded | ADMIN-01 | 4 | **G-2 sketch** (admin shell); **threat model** (service-role / no-RLS-backstop, default-deny 404); one-way-door `operator_users` schema; `org_id` stubs; UI hint |
| 147 | Operator Control Plane | An operator watches system health + active runs, kills a runaway run, and disables a misbehaving capability or enters maintenance mode | ADMIN-02, FLAG-01 | 4 | **SC#10** (active-runs + Kill touch run/stream state); **G-2 sketch** (live control panel); fail-closed kill-switches; UI hint |
| 148 | Governance — Audit, Users & Feature Visibility | An operator investigates the audit trail, manages user access, and controls which advanced features end users can see | ADMIN-03, VIS-01 | 4 | **threat model** (cross-user reads, no RLS backstop); **G-2 sketch** (audit/user browser); VIS-01 API-layer enforced (not UI-only); impersonation slice → STRETCH / named-trigger; UI hint |
| 149 | Model Registry & Discovery | An operator edits model capabilities and runs live discovery — no restart, no silent capability guesses | MODEL-01, MODEL-02 | 4 | **SC#10** (capability changes affect provider routing); **G-2 sketch** (model-mgmt UI); propose-not-auto-enable; read path already live (mig 053); UI hint |
| 150 | Secrets at Rest | Provider API keys in the DB are encrypted at rest while local dev + existing deployments keep working unchanged | SEC-01 | 4 | **threat model** (secrets at rest); app-layer `cryptography` (NOT pgsodium); env-fallback precedence preserved; round-trip-verified saves |
| 151 | Agent File Tools | The agent pulls a real KB file into its sandbox to operate on it, and attaches files to a skill it's authoring | FILE-02, FILE-01 | 4 | **SC#10** (new agent tools in the loop); **threat model** FILE-01 (WRITE surface) + FILE-02 (RAG→sandbox exfil / size-cap / path); internal order FILE-02 (read) → FILE-01 (write) |
| 152 | Workflow Run Inputs | A user feeds a workflow run a file + chooses its KB scope at launch, and can safely delete a workflow | WFIN-01, WFIN-02, WFIN-03 | 3 | **SC#10** (run-input channel + folder scope affect retrieval/routing); **G-2 sketch** (Run modal); **threat model** WFIN-01 (upload/SSTI provenance); SEED-112 scope-shape = discuss/sketch decision (Perplexity 3-way toggle reference); UI hint |
| 153 | Inline Citations | Chat answers show per-claim citation markers keyed to the run's actual retrieval set, with click-through to source | CITE-01 | 4 | **G-2 sketch** (mandatory); **G-5** (`MessageItem.tsx` / `StreamsProvider.tsx`); **SC#10**; Pitfall 14 (set-membership, never post-hoc re-ask); UI hint |
| 154 | Plain-Language Layer | User-facing surfaces speak plain language with technical terms behind an advanced reveal — no contract breaks | LANG-01 | 3 | Pitfall 15 (never break enum/API/audit contracts; Deep byte-identical); extends the Phase-124 two-door pattern app-wide; UI hint |
| 155 | Accessibility Sweep — WCAG AA | Every net-new v3.3 surface passes axe-core + manual keyboard AA, and the worst pre-existing offenders are fixed | A11Y-01 | 3 | sequenced **LAST** (audits all net-new surfaces once stable); new dev-only deps `@axe-core/playwright` + `eslint-plugin-jsx-a11y`; UI hint |

### Phase Table (STRETCH — gated behind CORE) — Phases 156-158

| Phase | Name | Goal (one-line) | Requirements | SC# | Depends |
|-------|------|-----------------|--------------|-----|---------|
| 156 | Everyday UX Polish | Collapsed nav keeps New Chat reachable and the thread list gets search + date/folder grouping | POLISH-01 (STRETCH) | 3 | — (SEED-045 anchors; gated on CORE); G-2 sketch if visual; UI hint |
| 157 | Deployment Presets & Runbook | An operator stands up a production deployment from documented Solo/Team/Enterprise preset bundles + an `OPERATOR.md` runbook | DEPLOY-01 (STRETCH) | 3 | — (docs/config; gated on CORE) |
| 158 | First-Run Install Wizard | A non-developer operator completes first-run setup through an idempotent, lock-after-finalize browser wizard at `/setup` | DEPLOY-02 (STRETCH) | 3 | 157 (uses the presets); the milestone's biggest lift → first to cut; UI hint |

### Phase Checklist

- [x] **Phase 146: Operator Foundation** — `operator_users` + default-deny `require_operator` (404) + `operator_audit_log` + `/admin` route tree + RBAC on `/admin/backpressure` + `org_id` stubs (ADMIN-01) — completed 2026-07-11
- [ ] **Phase 147: Operator Control Plane** — health/backpressure + active-runs-with-Kill + per-feature kill-switches + maintenance/read-only mode (ADMIN-02, FLAG-01)
- [ ] **Phase 148: Governance — Audit, Users & Feature Visibility** — audit browser (filter/paginate/CSV) + user list disable/enable + API-enforced feature greenlists (ADMIN-03, VIS-01)
- [ ] **Phase 149: Model Registry & Discovery** — write UI over `model_capabilities_overrides` + `model_discovery_service` propose-only (MODEL-01, MODEL-02)
- [ ] **Phase 150: Secrets at Rest** — app-layer `cryptography` envelope encryption of `app_settings` key columns + env-fallback + round-trip-verified saves (SEC-01)
- [ ] **Phase 151: Agent File Tools** — `fetch_document_file` (KB→sandbox, read) → `attach_skill_file` (agent→skill, write) (FILE-02, FILE-01)
- [ ] **Phase 152: Workflow Run Inputs** — Run-modal template upload + editable KB folder-scope + safe workflow delete cascade (WFIN-01, WFIN-02, WFIN-03)
- [ ] **Phase 153: Inline Citations** — per-claim markers keyed to the run's real retrieval set + click-through + absence-as-signal (CITE-01)
- [ ] **Phase 154: Plain-Language Layer** — two-audience plain-language labels app-wide behind an advanced reveal, contracts untouched (LANG-01)
- [ ] **Phase 155: Accessibility Sweep — WCAG AA** — axe-core + manual keyboard AA on all net-new surfaces + worst pre-existing offenders (A11Y-01)
- [ ] **Phase 156 (STRETCH): Everyday UX Polish** — collapsed-nav New Chat + thread-list search + date/folder grouping (POLISH-01)
- [ ] **Phase 157 (STRETCH): Deployment Presets & Runbook** — Solo/Team/Enterprise env + `docker-compose.prod.yml` + `OPERATOR.md` (DEPLOY-01)
- [ ] **Phase 158 (STRETCH): First-Run Install Wizard** — `/setup` browser flow, idempotent, lock-after-finalize (DEPLOY-02)

### Phase 146: Operator Foundation

**Goal**: A designated operator can reach a gated `/admin` surface that no ordinary user can even discover, and every operator action is recorded — with the operator-role schema deliberately shaped so the v3.4 multi-tenancy RLS rewrite is not poisoned.
**Depends on**: Nothing (first phase of v3.3; builds on shipped v3.2 substrate — `admin.py` router, `/admin/backpressure`, the `app_settings` TTL cache)
**Requirements**: ADMIN-01
**Success Criteria** (what must be TRUE):

  1. A user listed in `operator_users` can open `/admin` and see the shell; a non-operator hitting any `/admin` route gets a **404** (not a 403 — non-discoverable).
  2. Every operator action writes a row to `operator_audit_log` (who / what / when).
  3. The existing `/admin/backpressure` endpoint is reachable only behind the `require_operator` gate.
  4. A normal user's JWT returns 404 on every `/admin` route (regression-tested), and `operator_users` is a system-level, org-agnostic principal with `org_id` stubs added where cheap.

**Plans**: 6 plans (4 waves)

Plans:
**Wave 1**

- [x] 146-01-PLAN.md — Migrations 095 (operator_users + operator_audit_log, RLS deny-all) + 096 (org_id stub sweep) + [BLOCKING] live apply + full-schema regen
- [x] 146-02-PLAN.md — require_operator router-level gate (byte-identical 404) + audit floor + delete BACKPRESSURE_ADMIN_USER_IDS + /admin/me probe + /admin/audit feed + gate regression suite

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 146-03-PLAN.md — OPERATOR_EMAILS idempotent lifespan seed (ON CONFLICT, WORKER_COUNT=2-safe) + seed tests
- [x] 146-04-PLAN.md — Frontend data layer: getOperatorProbe (404→null) / getBackpressure / getOperatorAudit + useOperatorProbe hook + test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 146-05-PLAN.md — 061-B/062-A leaf components: OperatorBand, HealthSignals, LockedTab, TechnicalNamesToggle, RecentActionsCard

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 146-06-PLAN.md — ControlRoomPage + AuditTab assembly, ↻ Refresh ledger beat, reachability triad (ActiveView + ChatLayout branch + probe-gated shield outside NAV_ITEMS) + NAV_ITEMS regression test

**UI hint**: yes

### Phase 147: Operator Control Plane

**Goal**: An operator can watch system health and running work, kill a runaway run, disable a misbehaving capability, and put the platform into maintenance/read-only mode.
**Depends on**: Phase 146 (needs `require_operator` + the `/admin` shell + `operator_audit_log`)
**Requirements**: ADMIN-02, FLAG-01
**Success Criteria** (what must be TRUE):

  1. An operator sees live health for Redis, Supabase, and the sandbox, plus the backpressure metrics, rendered in the `/admin` shell.
  2. An operator sees active runs (thread / user / model / elapsed) and can Kill a run, which cancels it (delegating to the existing `cancel_run` zombie-heal path).
  3. An operator can toggle per-feature kill-switches (web search, sandbox, self-improve, workflows) and the disabled capability stops working for all users (fail-closed).
  4. An operator can enable maintenance/read-only mode and end users see the platform become read-only, on the existing `app_settings` TTL-cached substrate (no new flag infrastructure).

**Plans**: 9 plans (3 waves)

Plans:
**Wave 1**

- [x] 147-01-PLAN.md — Flag substrate: migration 097 (3 app_settings booleans) + fail-closed read helpers (D-Q4 polarity) [FLAG-01]
- [x] 147-02-PLAN.md — Health probes (Redis/Supabase/sandbox additive on /backpressure) + cross-user active-runs read (D-Q1 kind derivation) + D-07 poll/visit floor discipline [ADMIN-02]
- [x] 147-06-PLAN.md — Frontend API contract (types + client fns) + BUG-260710-01/-02 cancelled-run honesty (render-only, G-5 safe) [ADMIN-02]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 147-03-PLAN.md — Operator Kill: factor cancel_run zombie-heal into a shared helper + POST /admin/runs/{id}/kill (victim-only audit) + PUT /admin/flags [ADMIN-02, FLAG-01]
- [x] 147-04-PLAN.md — Two-layer fail-closed capability kill-switches (hide + refuse + proposer guard) + D-05 workflow-launch block [FLAG-01]
- [x] 147-05-PLAN.md — Maintenance write-block middleware + off-switch allowlist + public /health flag [FLAG-01]
- [x] 147-07-PLAN.md — HealthSignals dependency dots + ActiveRunsSection (064-B cards, victim-naming Kill, honest Cancelling->Cancelled) [ADMIN-02]
- [x] 147-08-PLAN.md — CapabilityGrid (065-A armed-OFF 2x2) + MaintenancePanel (amber arm-to-confirm) [FLAG-01]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 147-09-PLAN.md — ControlRoomPage recompose (D-08 promote + 063-B scroll + D-07 auto-poll/visit) + end-user maintenance banner [ADMIN-02, FLAG-01]

**UI hint**: yes

### Phase 148: Governance — Audit, Users & Feature Visibility

**Goal**: An operator can investigate what happened and govern who can do and see what — browse the audit trail, manage user access, and hide advanced/technical features from end users at the API layer.
**Depends on**: Phase 146 (needs the operator gate + shell + audit substrate)
**Requirements**: ADMIN-03, VIS-01
**Success Criteria** (what must be TRUE):

  1. An operator can browse `audit_log` with action-type + date-range filters, pagination, and CSV export of the filtered set.
  2. An operator can list users with last-active and disable/enable a user; a disabled user cannot access the app.
  3. Advanced features (eval studio, model management, trigger tuner) are hidden from end users and visible only to operators — enforced at the API layer (a non-operator API call is refused, not merely UI-hidden), per a per-feature visibility map.
  4. Cross-user read paths in the admin browser are explicitly filtered (no full-tenant leak on the service-role client).

**Plans**: 9 plans in 6 waves
- [x] 148-01-PLAN.md — Wave 0 test scaffold (16 test_148_* files + conftest fixtures)
- [x] 148-02-PLAN.md — Backend substrate: migration 098 + audience resolver/writer + require_visible + app-layer ban check
- [ ] 148-03-PLAN.md — Apply migration 098 to the live DB + regenerate full-schema (operator step)
- [x] 148-04-PLAN.md — Governance + operator service layer (audit query/CSV, roster, grant/revoke)
- [ ] 148-05-PLAN.md — VIS-01 enforcement wiring: GET /features + require_visible across governed routers (Run carve-outs)
- [ ] 148-06-PLAN.md — Operator admin endpoints (platform browse/export, users disable/enable, grant/revoke, visibility set)
- [ ] 148-07-PLAN.md — Frontend VIS-01 enforcement: effective-features hook + nav vanish + graceful 403 bounce
- [ ] 148-08-PLAN.md — 067-A audit browser: source switch + chip filters + pager + recorded CSV
- [ ] 148-09-PLAN.md — 068-A users roster (victim-naming guards) + 069-A feature-visibility audience rows
**Note**: "Sign in as user" impersonation ships only if scoped cheaply (dual-identity audit); otherwise it is deferred to STRETCH with a named re-open trigger.
**UI hint**: yes

### Phase 149: Model Registry & Discovery

**Goal**: An operator can manage model capabilities from the admin shell and discover new provider models — without a server restart and without silently guessing capabilities the provider never returned.
**Depends on**: Phase 146 (operator-gated write path); the read path (`model_capabilities_overrides`, `get_model_capability_async`) is already live from migration 053
**Requirements**: MODEL-01, MODEL-02
**Success Criteria** (what must be TRUE):

  1. An operator can edit a model's capabilities (enable/disable, max tokens, timeout, native tools, deprecated) from the admin shell and the change takes effect on the next request with no restart (existing TTL cache).
  2. An operator can run live model discovery, which queries each provider's `/models` and proposes new/changed/vanished models for confirmation.
  3. Discovery never auto-enables a capability the provider's `/models` endpoint did not return (propose-only — reproducing the silent no-tools bug is barred).
  4. A non-operator cannot reach the model-write path.

**Plans**: TBD
**UI hint**: yes

### Phase 150: Secrets at Rest

**Goal**: Provider API keys stored in the database are encrypted at rest, while local dev and existing deployments keep working with no manual key re-entry.
**Depends on**: Phase 146 (key management is operator-gated); pairs with Phase 149 as the Track-3 settings-management work
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):

  1. A provider API key saved through Settings is stored encrypted at rest (app-layer `cryptography` Fernet/AESGCM), not as plaintext in `app_settings`.
  2. Saving a key is round-trip verified — a failed save surfaces an error instead of silently succeeding.
  3. When a key is supplied via env var, the platform still works without any DB-stored secret (env-fallback precedence preserved; a DB read is never mandatory for a secret env can supply).
  4. Existing deployments and local dev continue to function with no manual key re-entry required.

**Plans**: TBD

### Phase 151: Agent File Tools

**Goal**: The agent can materialize a real KB file into its sandbox to faithfully convert/render/operate on it, and can attach files it creates (or a template the user hands it mid-conversation) to a skill it owns — each reusing an existing owner-scope resolver, never inventing a new one.
**Depends on**: None (code-independent of the admin/model tracks; both tools register in the flat `_TOOL_REGISTRY` without touching `threads.py`). Sequenced here per the researched build order and the Glean/Beam UX gate.
**Requirements**: FILE-02, FILE-01
**Success Criteria** (what must be TRUE):

  1. The agent can call `fetch_document_file` to stream a KB document's ORIGINAL bytes into the sandbox working directory (owner/RLS-scoped, size-capped) and then convert/render/operate on the real file instead of reconstructing from text.
  2. The agent can call `attach_skill_file` to save a file it created onto a skill it owns (reusing `skill_files` + bucket), and cannot write to global/built-in skills.
  3. A user can hand the agent an existing template file mid-conversation and the agent attaches it to the skill.
  4. Neither tool can read or write another user's documents or skills (owner-scope enforced, proven cross-user), and both hold across providers (SC#10).

**Plans**: TBD
**Note**: Internal build order FILE-02 (pure new READ tool, lowest coupling) → FILE-01 (WRITE tool, whose threat model becomes the reference upload/threat pattern). Each carries its own threat model.

### Phase 152: Workflow Run Inputs

**Goal**: A user can feed a workflow run a file and choose its knowledge scope at launch from the Run modal, and can safely delete a workflow — all through one shared run-input channel wired into `create_workflow_run.inputs`.
**Depends on**: Phase 151 (WFIN-01 reuses the upload/threat-model pattern established by FILE-01)
**Requirements**: WFIN-01, WFIN-02, WFIN-03
**Success Criteria** (what must be TRUE):

  1. From the Run modal a user can upload a file (e.g. a docx template) as a run input; it is stored with untrusted provenance (`kind='template_input'`), size/MIME-allowlisted, and is never routed to the Jinja engine.
  2. From the Run modal a user can point the workflow's retrieval at a chosen KB folder (author-time default + per-run override) reusing the Phase-098 server-side scope resolver, so the model cannot widen scope; behavior is identical across providers.
  3. A user can delete a workflow with a safe cascade (definitions / versions / runs disposition made explicit at discuss) behind a confirmation, leaving no orphaned runs or threads.

**Plans**: TBD
**Note**: The SEED-112 scope-control shape (definition-time field vs run-input selector vs both) is a discuss-phase/sketch decision, Glean/Beam-informed (the milestone-level research directive is satisfied; the control shape is not yet locked).
**UI hint**: yes

### Phase 153: Inline Citations

**Goal**: Chat answers show per-claim citation markers tied to what the agent actually retrieved this run, with click-through to the source passage, and claims without a marker read as general knowledge (the converged industry pattern).
**Depends on**: None hard (agent-loop retrieval + `MessageItem`); sequenced late deliberately because it is the milestone's largest lift and the only track touching G-5 hot files under active churn.
**Requirements**: CITE-01
**Success Criteria** (what must be TRUE):

  1. A grounded claim shows an inline citation marker keyed to the run's ACTUAL retrieval set (set-membership, never a post-hoc LLM re-ask).
  2. Clicking a marker opens the source passage.
  3. Claims without a marker read as general knowledge (absence-as-signal) — no fabricated attributions (Pitfall 14).
  4. Inline markers render consistently across all providers (SC#10) and Deep Mode stays byte-identical where unchanged.

**Plans**: TBD
**Note**: G-2 sketch-first is mandatory (live UI, "feels like"); the set-membership attribution design must be nailed down before coding.
**UI hint**: yes

### Phase 154: Plain-Language Layer

**Goal**: User-facing surfaces speak plain language, with technical terms tucked behind an admin/advanced reveal — extending the Phase-124 two-door pattern app-wide — without breaking any enum/API/audit contract.
**Depends on**: Phases 146-153 (relabels across the net-new admin + Run-modal + citation surfaces plus existing surfaces)
**Requirements**: LANG-01
**Success Criteria** (what must be TRUE):

  1. Everyday users see plain-language labels across the app; technical terms appear only behind an admin/advanced reveal.
  2. Relabels are display-only — underlying enum values, API contracts, and audit action names are unchanged (verified; Pitfall 15), and Deep Mode stays byte-identical.
  3. An operator/advanced user can flip the reveal and see the technical vocabulary.

**Plans**: TBD
**UI hint**: yes

### Phase 155: Accessibility Sweep — WCAG AA

**Goal**: Every net-new v3.3 surface passes automated and manual accessibility checks at WCAG 2.1 AA, and the worst pre-existing app-wide offenders are fixed in the same pass.
**Depends on**: Phases 146-154 (audits all net-new surfaces once they exist and are stable — sequenced last by design)
**Requirements**: A11Y-01
**Success Criteria** (what must be TRUE):

  1. All net-new v3.3 surfaces (admin shell, Run-modal inputs, citation UI) pass an automated `axe-core` scan with zero violations.
  2. Each net-new surface is fully operable via keyboard (manual walkthrough) at WCAG 2.1 AA.
  3. The worst pre-existing offenders (contrast tokens, unlabeled icon buttons) are fixed in the same pass.

**Plans**: TBD
**UI hint**: yes

### Phase 156: Everyday UX Polish (STRETCH)

**Goal**: The everyday chat navigation stays convenient and threads are easy to find — the two confirmed SEED-045 anchors plus triaged minor-enhancement umbrella items that fit the phase.
**Depends on**: Nothing hard; gated behind CORE (ships only if CORE lands clean and budget remains)
**Requirements**: POLISH-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. With the nav collapsed, New Chat stays reachable.
  2. The thread list supports search.
  3. Threads are grouped by date and/or folder.

**Plans**: TBD
**UI hint**: yes

### Phase 157: Deployment Presets & Runbook (STRETCH)

**Goal**: An operator can stand up a production deployment from documented preset bundles and a runbook that supersedes the recovered VPS guides.
**Depends on**: Nothing hard (docs + reference config); gated behind CORE
**Requirements**: DEPLOY-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. Solo/Team/Enterprise env-var + `docker-compose.prod.yml` reference configurations exist and are documented.
  2. An `OPERATOR.md` runbook supersedes the recovered VPS guides and walks an operator through a production stand-up.
  3. Following the runbook with a preset produces a working deployment (smoke-verified).

**Plans**: TBD

### Phase 158: First-Run Install Wizard (STRETCH)

**Goal**: A non-developer operator can complete first-run setup through a browser wizard instead of editing files by hand.
**Depends on**: Phase 157 (the wizard drives the presets); gated behind CORE — the milestone's biggest single lift, so the first to be cut if capacity is tight
**Requirements**: DEPLOY-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. A browser flow at `/setup` walks environment detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test.
  2. The wizard is idempotent and locks out after finalize.
  3. A non-developer can complete setup end-to-end without hand-editing files.

**Plans**: TBD
**UI hint**: yes

### Progress (v3.3)

**Execution order:** 146 → 147 → 148 → 149 → 150 → 151 → 152 → 153 → 154 → 155, then STRETCH 156 → 157 → 158 (gated behind CORE).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 146. Operator Foundation | 6/6 | Complete | 2026-07-11 |
| 147. Operator Control Plane | 0/? | Not started | - |
| 148. Governance — Audit, Users & Feature Visibility | 3/9 | In Progress | - |
| 149. Model Registry & Discovery | 0/? | Not started | - |
| 150. Secrets at Rest | 0/? | Not started | - |
| 151. Agent File Tools | 0/? | Not started | - |
| 152. Workflow Run Inputs | 0/? | Not started | - |
| 153. Inline Citations | 0/? | Not started | - |
| 154. Plain-Language Layer | 0/? | Not started | - |
| 155. Accessibility Sweep — WCAG AA | 0/? | Not started | - |
| 156 (STRETCH). Everyday UX Polish | 0/? | Gated (behind CORE) | - |
| 157 (STRETCH). Deployment Presets & Runbook | 0/? | Gated (behind CORE) | - |
| 158 (STRETCH). First-Run Install Wizard | 0/? | Gated (behind CORE) | - |

**Coverage:** 19/19 requirements mapped (16 CORE + 3 STRETCH); 0 unmapped. Every requirement → exactly one phase.

**Sequencing rationale (research-corroborated — SUMMARY.md "Implications for Roadmap", independently by ARCHITECTURE + PITFALLS):**

- **Operator foundation FIRST (146):** ADMIN-01 is the keystone — every admin-gated write (model registry, kill-switch, audit browser, feature visibility) needs `require_operator` + `operator_audit_log` to exist first, and it locks the v3.4 one-way-door role-schema decision, so it is scoped deliberately, not rushed.
- **Model registry + discovery early (149):** the highest-ROI/lowest-cost closure — the read path (`model_capabilities_overrides`, `get_model_capability_async`) is already live (mig 053); only the write UI + a discovery service are missing. Secrets-at-rest (150) is the separable Track-3 security sub-phase.
- **Workflow file-input cluster with an internal build order:** FILE-02 (pure new READ tool, lowest coupling) → FILE-01 (WRITE tool, whose threat model becomes the reference upload pattern) in 151; then WFIN-01 + WFIN-02 ship TOGETHER on the shared run-input channel with WFIN-03 (safe delete) riding the cluster in 152.
- **UX track last:** CITE-01 (153) is the largest single lift, touches the G-5 hot files (`MessageItem.tsx` / `StreamsProvider.tsx`), and is G-2 sketch-gated — safest once the rest of the milestone's surfaces are stable. LANG-01 (154) then relabels app-wide, and A11Y-01 (155) audits every net-new surface last.

**SC#10 (cross-provider mandate):** flagged on every phase touching streaming / agent loop / provider routing / UI state — the two new agent tools (151), the run-input channel + folder scope (152), inline citations (153), the model-registry UI state (149), and the operator control-plane active-runs/Kill (147).

**UI hint:** 146, 147, 148, 149, 152, 153, 154, 155 (CORE) + 156, 158 (STRETCH).

**G-2 sketch-gated (`/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`):** 146 (admin shell), 147 (live control panel), 148 (audit/user browser), 149 (model-mgmt UI), 152 (Run-modal controls), 153 (inline citations — mandatory), and 156 if visual. `sketch-findings-agentic-rag` already names the composer, the workflow run surface, and Settings model pickers; extend it for the admin shell + Run modal + inline-citation surfaces.

**Dedicated threat models (new WRITE/upload surfaces):** FILE-01 (151, agent→skill WRITE), FILE-02 (151, RAG→sandbox bridge), WFIN-01 (152, run-time upload / SSTI provenance boundary). Plus the standing admin-isolation threat model on 146/148 (service-role, no RLS backstop).

**G-5 hot files (audit at discuss-phase):** `frontend/src/components/chat/MessageItem.tsx` + `frontend/src/providers/StreamsProvider.tsx` (inline citations, 153 — re-run replay/render tests; do NOT regress the shared render path). `backend/app/api/threads.py` stays untouched — the two new agent tools register in the flat `_TOOL_REGISTRY` (`tool_dispatcher.py`).

**Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Reported-bugs:** 10 open `surface: Agentic-RAG` reports roll into the v3.3 UAT blast radius (nav/display + provider-polish); cross-check at each `/gsd:discuss-phase` per the reported-bugs mandate. Verification debt riding from v3.2 (140/141/142/143 live-UAT gaps) must not regress.

Roadmap detail: this section. Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md`.

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
