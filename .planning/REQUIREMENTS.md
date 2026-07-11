# Requirements: Agentic RAG — v3.3 Operator UX

**Defined:** 2026-07-10
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Research base:** `.planning/research/SUMMARY.md` (4-dimension + Glean/Beam competitor synthesis, 2026-07-10). Ground truth supersedes the stale `PRDs/v3.2-operator-ux.md` brief (D-PRD business decisions hold; §5/§6 internals corrected against live code).
**Seeds consumed:** SEED-104 (FILE-01), SEED-110, SEED-112, SEED-108, SEED-111 (gap add), SEED-012, SEED-095, SEED-099, SEED-078, SEED-088, SEED-040, SEED-024 (remaining half), SEED-003, SEED-085, SEED-033, SEED-045, SEED-092.

## v3.3 Requirements

Requirements for this milestone. Each maps to roadmap phases. CORE vs gated-STRETCH split happens at roadmap creation (v3.1/v3.2 precedent); research flags DEPLOY-01/02 as the natural STRETCH tail.

### Workflow & File Inputs (Track 1)

- [ ] **FILE-01**: Agent can attach files it creates (scripts, assets) to a skill during authoring via a new `attach_skill_file` tool, and a user can hand the agent an existing template file mid-conversation for the agent to attach — owner-scoped, reusing the existing `skill_files` table + bucket, with its own threat model (carried from v3.2 Phase 144, never executed)
- [ ] **FILE-02**: Agent can materialize a KB document's ORIGINAL bytes into the sandbox working directory via a new `fetch_document_file` tool (owner/RLS-scoped, size-capped, streamed to disk) so it can faithfully convert/render/operate on the real file instead of refusing or reconstructing from text
- [ ] **WFIN-01**: User can upload a file (e.g. a docx template to fill) as a workflow run input from the Run modal — stored with the untrusted-upload provenance stamp (`kind='template_input'`, never routed to the Jinja engine), size/MIME allowlisted, wired through `create_workflow_run.inputs` into the existing whitelist-gated fill path
- [ ] **WFIN-02**: User can point a workflow's retrieval at a chosen KB folder — author-time default plus per-run override on the Run modal (the read-only bound-folder chip becomes selectable) — reusing the Phase 098 server-side scope resolver so the model cannot widen scope; identical behavior across providers
- [ ] **WFIN-03**: User can delete a workflow with a safe cascade (definitions, versions, runs disposition made explicit — archive vs hard-delete decided at phase discuss), with confirmation and no orphaned runs/threads (SEED-111 gap add)

### Admin Shell (Track 2)

- [x] **ADMIN-01**: A system-level operator role exists (`operator_users` table — org-agnostic principal, deliberately NOT a JWT claim or `is_admin` boolean, forward-compatible with the v3.4 org-RBAC rewrite) with a default-deny `require_operator` gate applied at router level; non-operators get 404 (non-discoverable); every operator action writes to an `operator_audit_log`
- [x] **ADMIN-02**: Operator can see system health (Redis / Supabase / sandbox probes) and the backpressure metrics from the existing `/admin/backpressure` endpoint rendered live in the `/admin` shell, plus an active-runs view (thread / user / model / elapsed) with a working Kill affordance (delegates to the existing `cancel_run` zombie-heal path)
- [ ] **ADMIN-03**: Operator can browse the `audit_log` table (action-type / date-range filters, pagination, CSV export of the filtered set) and manage users (list with last-active, disable/enable) — read paths explicitly filtered (no RLS backstop exists on service-role); "Sign in as user" impersonation only if scoped cheaply, else deferred with a named trigger
- [x] **FLAG-01**: Operator can disable a misbehaving capability (per-feature kill-switches: web search, sandbox, self-improve, workflows) and enable a maintenance/read-only mode — built on the existing `app_settings` TTL-cached substrate, fail-closed, no new flag infrastructure
- [ ] **VIS-01**: Advanced/technical features (eval studio, model management, trigger tuner) are hidden from end users and visible only to operator-tier users — enforced at the API layer (not UI-only gating), with the visibility map defined per feature

### Model & Settings Management (Track 3)

- [ ] **MODEL-01**: Operator can edit model capabilities (enable/disable, max tokens, timeout, native tools, deprecated) from the admin shell — a write UI + operator-gated write path over the ALREADY-LIVE `model_capabilities_overrides` table and hot-path read (mig 053); changes take effect without a server restart (existing TTL cache)
- [ ] **MODEL-02**: Operator can run live model discovery — a service (lifted from `scripts/curate_models.py`) queries each provider's `/models` endpoint and PROPOSES new/changed/vanished models for human confirmation; discovery never auto-enables capabilities the endpoint didn't return (only 2 of 8 providers return capability metadata)
- [ ] **SEC-01**: Provider API keys stored in `app_settings` are encrypted at rest (app-layer `cryptography` Fernet/AESGCM — NOT pgsodium, which Supabase is deprecating) with the env-var fallback precedence preserved so local dev and existing deployments keep working unchanged; key saves are round-trip verified (never silently swallowed)

### Deployment & Packaging (Track 3, STRETCH tail per research)

- [ ] **DEPLOY-01**: An operator can stand up a production deployment from documented preset bundles — Solo/Team/Enterprise env-var + `docker-compose.prod.yml` reference configurations plus an `OPERATOR.md` runbook that supersedes the recovered VPS guides
- [ ] **DEPLOY-02**: A first-run install wizard (browser flow at `/setup`, idempotent, locked out after finalize) walks a non-developer operator through environment detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test

### Trust & Friendliness UX (Track 4, Glean/Beam-informed)

- [ ] **CITE-01**: Chat responses show inline per-claim citation markers keyed to the run's ACTUAL retrieval set (set-membership, never a post-hoc LLM re-ask) with click-through to the source passage; claims without a marker read as general knowledge (absence-as-signal, the converged industry pattern) — G-2 sketch-gated, G-5 hot-file check first, SC#10 cross-provider
- [ ] **LANG-01**: User-facing surfaces speak plain language with technical terms behind an admin/advanced reveal (two-audience layer extending the shipped Phase-124 two-door pattern app-wide); renames never break enum/API/audit contracts
- [ ] **POLISH-01**: Collapsed nav keeps New Chat reachable, and the thread list gets search + date/folder grouping (the two confirmed SEED-045 anchors, plus triaged minor-enhancement umbrella items that fit the phase)
- [ ] **A11Y-01**: All net-new v3.3 surfaces (admin shell, Run-modal inputs, citation UI) pass an automated axe-core scan + manual keyboard walkthrough at WCAG 2.1 AA; worst pre-existing app-wide offenders (contrast tokens, unlabeled icon buttons) fixed in the same pass

## Future Requirements

Deferred to future milestones. Tracked but not in the v3.3 roadmap.

### Admin & Governance

- **Usage/cost analytics in the admin shell** — the sixth Glean console surface; requires the token→USD rate registry (SEED-073/074, v3.4-assumed infra)
- **HashiCorp Vault / external secrets adapters** — enterprise tier, after SEC-01's backend abstraction proves out
- **Full app-wide WCAG AA sweep** — A11Y-01 covers net-new + worst offenders; the exhaustive audit rides a later polish slot (SEED-092 remainder)

### Platform

- **Org/dept multi-tenancy, SSO, org-admin RBAC** — v3.4 (one-way door; v3.3 ships only forward-compatible shapes)
- **Public REST API + MCP + service accounts** — v3.5 Open Platform (SEED-013)
- **Automations & routines / schedulers** — v3.6 (SEED-014)
- **Malware scanning (ClamAV) on uploads** — Enterprise-preset add-on once DEPLOY-02 exists

## Out of Scope

Explicitly excluded from v3.3. Documented so we don't relitigate.

| Feature | Reason |
|---------|--------|
| Org-level RBAC / JWT custom claims for roles | Reserved for v3.4; using claims now would poison the one-way-door RLS rewrite (research Pitfall 2) |
| Feature-flag SaaS (LaunchDarkly/Unleash/Flagsmith) | Over-scoped for a handful of global booleans; `app_settings` substrate suffices (FLAG-01) |
| pgsodium-based secrets encryption | Supabase has it in a deprecation cycle; app-layer `cryptography` chosen (SEC-01) |
| Auto-enabling discovered model capabilities | `/models` doesn't return capabilities for 6 of 8 providers; auto-enable reproduces the silent no-tools bug (MODEL-02 proposes only) |
| Explicit "from your docs" labels on cited text | Anti-feature — no competitor ships it; absence-of-marker IS the signal (CITE-01) |
| Per-user granular ACL matrix | Premature before IdP groups exist (v3.4+) |
| Saving run-time uploaded templates to the trusted library implicitly | Would carry untrusted provenance into the Jinja engine (SSTI); any promotion path must be explicit + reviewed |
| Grafana/Prometheus bundled observability stack | Operators bring their own; at most a `/metrics` endpoint later |

## Traceability

Which phases cover which requirements. Filled by roadmap creation (2026-07-10). CORE = Phases 146-155; STRETCH = Phases 156-158 (gated behind CORE).

| Requirement | Phase | Track | Status |
|-------------|-------|-------|--------|
| ADMIN-01 | Phase 146 (CORE) | Admin Shell | Pending |
| ADMIN-02 | Phase 147 (CORE) | Admin Shell | Pending |
| FLAG-01 | Phase 147 (CORE) | Admin Shell | Pending |
| ADMIN-03 | Phase 148 (CORE) | Admin Shell | Pending |
| VIS-01 | Phase 148 (CORE) | Admin Shell | Pending |
| MODEL-01 | Phase 149 (CORE) | Model & Settings | Pending |
| MODEL-02 | Phase 149 (CORE) | Model & Settings | Pending |
| SEC-01 | Phase 150 (CORE) | Model & Settings | Pending |
| FILE-02 | Phase 151 (CORE) | Workflow & File Inputs | Pending |
| FILE-01 | Phase 151 (CORE) | Workflow & File Inputs | Pending |
| WFIN-01 | Phase 152 (CORE) | Workflow & File Inputs | Pending |
| WFIN-02 | Phase 152 (CORE) | Workflow & File Inputs | Pending |
| WFIN-03 | Phase 152 (CORE) | Workflow & File Inputs | Pending |
| CITE-01 | Phase 153 (CORE) | Trust & Friendliness UX | Pending |
| LANG-01 | Phase 154 (CORE) | Trust & Friendliness UX | Pending |
| A11Y-01 | Phase 155 (CORE) | Trust & Friendliness UX | Pending |
| POLISH-01 | Phase 156 (STRETCH) | Trust & Friendliness UX | Pending |
| DEPLOY-01 | Phase 157 (STRETCH) | Deployment & Packaging | Pending |
| DEPLOY-02 | Phase 158 (STRETCH) | Deployment & Packaging | Pending |

**Coverage:** 19/19 requirements mapped (16 CORE + 3 STRETCH); 0 orphaned; every requirement → exactly one phase.

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-10 (traceability filled at roadmap creation — v3.3 Phases 146-158)*
