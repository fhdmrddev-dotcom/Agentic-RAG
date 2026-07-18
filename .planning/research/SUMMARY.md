# Project Research Summary

**Project:** Agentic RAG platform — v3.3 "Operator UX" milestone
**Domain:** Subsequent-milestone integration on a mature, self-hosted B2B agentic-RAG platform (React/Vite + FastAPI + Supabase + Redis) — adding an operator/admin tier, dynamic model + secrets management, workflow run-inputs (file upload + KB scoping), and a plain-language/citation/a11y UX layer, benchmarked against Glean and Beam AI.
**Researched:** 2026-07-10
**Confidence:** HIGH

## Executive Summary

v3.3 is an **integration milestone, not a greenfield build** — and the single biggest finding across all four research files is that the live codebase has already quietly solved more of this milestone than the planning brief assumed. The stale `PRDs/v3.2-operator-ux.md` (authored 2026-05-10, before the entire v2.7–v3.2 workflow/skill/DM surface shipped) is wrong on its two most load-bearing technical claims: **secrets are no longer on disk** (`settings_override.json` was eliminated in Phase 081.1; the real remaining gap is *encryption-at-rest* of plaintext provider-key columns in `app_settings`), and **the dynamic model registry already has a live table + hot-path read** (`model_capabilities_overrides`, migration 053) — only the write UI and a discovery service are missing. Both corrections, plus a third — the backend runs entirely on the Supabase **service-role key**, so `/admin` routes have **zero RLS backstop** and every isolation guarantee must be enforced in application code — recur across STACK, ARCHITECTURE, and PITFALLS and should be treated as the ground truth for requirements, superseding the brief.

The recommended approach is deliberately low-new-dependency and pattern-reuse-first: nearly every backend package the milestone needs (`cryptography`, `filetype`, `defusedxml`, `pyjwt`) is **already installed transitively**, and every net-new capability — the admin shell, the model registry write UI, run-time file inputs, and per-run KB scoping — plugs into an existing seam (`_TOOL_REGISTRY`, `admin.py`, `config.get_model_capability_async`, `harness/scope.py`, the whitelist-gated template-render engine) rather than requiring new infrastructure. The FEATURES research (a mandatory Glean/Beam competitor study) confirms this integration-first posture is also the competitively correct one: Glean, Beam AI, Perplexity Enterprise, Dust, and Onyx all converge on the same shapes — an admin console with users/roles/models/audit, declared typed run inputs, per-agent/per-run KB scope selection, and inline per-claim citation markers with absence-as-signal — and this app already owns the retrieval-scope resolver, the citation data channel, and (uniquely) a sandboxed code-execution + skill-eval capability none of the named competitors match.

The key risk is security-shaped, not feature-shaped: because there is no RLS backstop, an admin route with a missing `WHERE user_id = …` filter is a full-tenant data leak, not a partial one, and the operator-role schema choice is a genuine **one-way door** against the v3.4 multi-tenancy RLS rewrite (a system-level `operator_users` principal, orthogonal to org membership, is the only safe shape). Secondary risks cluster around the new WRITE-capable and file-ingestion surfaces (agent skill-attach, RAG→sandbox bridge, run-time template upload) reaching provenance-sensitive paths (the Jinja/`docxtpl` SSTI boundary) without re-deriving the owner-scope and provenance checks that already exist elsewhere in the codebase. Mitigation is consistent across PITFALLS: a single `require_operator` FastAPI dependency at the router level (default-deny, 404 not 403), reuse (never duplicate) existing owner/provenance resolvers, fail-closed kill-switches, and human-confirmed (never auto-enabled) model-capability discovery.

## Key Findings

### Recommended Stack

The stack conclusion is "declare what's already resolved, add almost nothing new." Backend: `cryptography` (Fernet/AESGCM) for app-layer envelope encryption of secrets — explicitly **not** `pgsodium`, which Supabase has placed in a deprecation cycle — plus `filetype` (pure-Python magic-byte sniffing, no libmagic) and `defusedxml` (XXE-safe OOXML parsing) for the new upload surfaces, and `pyjwt` for optional impersonation tokens; all four are already installed transitively. Live `/models` discovery lifts the existing `scripts/curate_models.py` (already covers all 8 providers) onto `httpx` as a backend service. Frontend needs exactly two new dev-only packages — `@axe-core/playwright` and `eslint-plugin-jsx-a11y` — for the WCAG AA gate; everything else (Radix primitives, `dompurify`, `react-markdown`, `vitest-axe`) is reused as-is. ClamAV/`clamd` malware scanning is explicitly gated as STRETCH/Enterprise-only, not CORE.

**Core technologies:**
- `cryptography` (Fernet/AESGCM, already 46.0.7) — app-layer encryption of `app_settings` provider-key columns — chosen over pgsodium (deprecating) and Supabase Vault (couples decrypt to a SQL view that fights the existing sync TTL-cache read path)
- `filetype` + `defusedxml` (already installed) — magic-byte content sniffing + XXE-safe XML parsing for template/skill uploads — pure-Python, no libmagic system dependency (Windows-dev-hostile alternative avoided)
- `operator_users` table + Postgres RLS + a FastAPI `require_operator` dependency — the operator role tier — explicitly **not** a JWT custom-claim/token-hook (reserved for v3.4 per-org RBAC) and **not** a policy-engine library (Casbin/oso), which would fight the existing RLS model
- `app_settings.feature_flags` (existing 30s TTL-cached substrate) — kill-switch/maintenance-mode — explicitly **not** a feature-flag SaaS (Unleash/Flagsmith/LaunchDarkly), which is over-scoped for a handful of global booleans
- `@axe-core/playwright` + `eslint-plugin-jsx-a11y` (new, dev-only) — the WCAG AA automated gate and shift-left lint, riding on Radix's built-in accessible primitives for the new admin dialogs

### Expected Features

The FEATURES research's Glean/Beam competitor study (operator-mandated, headline section) found the industry has fully converged on a small set of patterns this milestone should adopt directly: attachable/scoped knowledge sources per agent or run, declared typed run-input fields (including a `file` type), a six-surface admin console (data/connectors, users+roles, model management, usage/analytics, governance/audit, active-runs monitoring with kill/re-run), role-gated "feature greenlists," and inline per-claim citation markers where the *absence* of a marker (not an explicit label) signals general-knowledge vs. grounded content. The app already has unique competitive edges worth defending and marketing: sandboxed agent-driven code execution, the Skill Eval Studio, 8-provider routing, and a self-host/own-your-data local↔cloud env-var switch — none of which Glean or Beam AI match.

**Must have (table stakes):**
- Operator role tier + `/admin` shell (health, active runs + kill, user list, audit browser) — the keystone; every other write-UI in the milestone sits behind it
- Model-management write UI over the already-live `model_capabilities_overrides` table — highest ROI, lowest cost in the whole milestone
- User-selectable KB scope on workflows (author default + run override), reusing the Phase 098 scope resolver — the operator's headline ask (SEED-112)
- Typed run inputs + run-time file upload (SEED-110 + FILE-01, sharing one upload/threat-model pattern)
- Inline per-claim citation markers (SEED-033) — universal across every competitor studied; the single largest UI/streaming lift in the milestone

**Should have (competitive):**
- Role-gated feature visibility / "greenlists" (SEED-099) — hide eval/model-mgmt/advanced surfaces from end users
- Plain-language two-audience labels (SEED-085), extending the existing Phase-124 strict↔loose two-door pattern app-wide
- RAG↔sandbox original-bytes bridge (SEED-108) — a genuine differentiator none of the studied competitors offer at this depth

**Defer (v2+ / v3.4):**
- Install wizard + Solo/Team/Enterprise deployment presets (SEED-003) — the single biggest lift in the brief; document as env-var bundles instead
- IdP/SSO group-based permissions and the full multi-tenant org/billing model — explicitly a v3.4 one-way door
- Per-user granular ACL matrix — premature before IdP groups exist

### Architecture Approach

v3.3 is almost entirely an **integration** exercise onto existing seams, not new subsystems. Every track has a concrete, verified plug-in point: new agent tools register in the flat `_TOOL_REGISTRY` dict (`tool_dispatcher.py`) without touching the just-extracted, hot-file-ledger-flagged `threads.py`; model-capability resolution stays exclusively in the provider-agnostic `config.get_model_capability_async` (never forked per-provider); KB-scope binding reuses the Phase 098 `harness/scope.py` resolver and the `phase_types.py` intersection seam; template fill reuses the provenance-gated `select_engine()` boundary that already refuses to route untrusted uploads to the Jinja/`docxtpl` engine; and the admin shell extends the already-existing (if minimal) `admin.py` router and `/admin/backpressure` endpoint rather than building a new backend surface from scratch.

**Major components:**
1. `operator_users` table + `require_operator` FastAPI dependency + `/admin` route tree (`admin.py`) — the net-new Track 2 foundation everything else depends on
2. `model_capabilities_overrides` write route/UI + a new `model_discovery_service.py` (lifted from `curate_models.py`) — Track 3's cheapest high-value closure over an already-live read path
3. Run-input channel (`RunModal → onLaunch → doRun → sendMessage → create_workflow_run.inputs`) carrying both the uploaded-template reference and the selected folder scope — the shared Track 1 plumbing for SEED-110 and SEED-112
4. `_TOOL_REGISTRY` additions — `fetch_document_file` (KB→sandbox, read), `attach_skill_file` (agent→skill, write) — each reusing an existing owner-scope resolver rather than inventing a new one
5. Inline-citation rendering layer over `MessageItem`/SSE — attribution keyed to the run's actual retrieval-set (set-membership, not a post-hoc LLM re-ask), layered on top of the existing citation data channel

### Critical Pitfalls

1. **The service-role client is the only isolation gate — `/admin` routes have no RLS backstop.** The entire backend reads/writes via the Supabase service-role key, so a missing `WHERE user_id =` filter on an admin route is a full-tenant leak, not a scoped one. Avoid with a single `require_operator` dependency applied at the router level (default-deny), a small reviewed set of cross-user query helpers, and a 403-regression test on every `/admin` route for a normal user's JWT.
2. **Modeling the operator role in a shape that poisons the v3.4 multi-tenancy RLS rewrite.** An `is_admin` boolean or "special org" model is a one-way door that forces v3.4 to special-case the operator inside every new org-scoped policy. Avoid by making `operator_users` a separate, org-agnostic principal from day one.
3. **A new run-time template-upload path that breaks the existing provenance→engine security boundary (SSTI).** The app's real defense is that uploads are provenance-stamped (`kind='template_input'`) and structurally barred from the Jinja/`docxtpl` engine — a new upload handler that infers engine from content/extension, or a "save to library" that silently carries provenance, defeats this. Never let library-promotion be implicit.
4. **Planning secrets work against the stale brief instead of the live code.** The brief's "get keys off disk" is already done (Phase 081.1); the real gap is plaintext columns in `app_settings` with no encryption-at-rest, and any fix must preserve the env-fallback that keeps local dev working (never make a DB read mandatory for a secret env can supply).
5. **Live model discovery auto-enabling capabilities that `/models` endpoints never actually return.** Only 2 of 8 providers return capability metadata (token limits); auto-enabling native-tool support on a guess reproduces the exact case-sensitivity "silent no-tools" bug already hit once in production. Discovery must propose; a human must confirm before enable.

## Implications for Roadmap

Based on combined research, the four milestone tracks are largely independent in scope but have one hard sequencing dependency and one soft (operator-directed) research gate. Suggested phase structure:

### Phase 1: Operator foundation — `operator_users` + `/admin` shell + RBAC boundary
**Rationale:** Every other admin-gated write (model registry, kill-switch, audit browser) needs the `get_current_operator` dependency and `operator_audit_log` to exist first; STACK, ARCHITECTURE, and PITFALLS all independently converge on "this must land first." It is also the phase where the one-way-door schema decision (Pitfall 3) gets locked, so it must be scoped deliberately, not rushed.
**Delivers:** `operator_users` table (system-level, org-agnostic), `require_operator` FastAPI dependency (default-deny, router-level), `operator_audit_log`, `/admin` frontend route tree separate from `SettingsPage`, RBAC gate swapped onto the existing `/admin/backpressure` endpoint, `org_id` nullable/no-FK stub columns extended to core tables.
**Addresses:** Track 2 table-stakes (admin console persona split, operator role tier) from FEATURES.md Part 3/5.
**Avoids:** Pitfalls 1 (service-role-only isolation), 2 (impersonation identity/audit — if impersonation ships here), 3 (operator-role v3.4 poisoning), 13 (UI-only role gating).

### Phase 2: Model & settings management — registry write UI + discovery + secrets-at-rest
**Rationale:** ARCHITECTURE and STACK both flag this as the highest-ROI/lowest-cost closure in the milestone — the read path (`model_capabilities_overrides`, `get_model_capability_async`) is already live; only the write UI, an RLS write policy or service-role write route, and a discovery service are missing. Secrets encryption is a separable sub-phase that can split off if capacity is tight.
**Delivers:** operator-gated write route/UI for `model_capabilities_overrides`, `model_discovery_service.py` (lifted from `curate_models.py`, `httpx`-based, per-provider degrade-gracefully), app-layer `cryptography` envelope encryption of `app_settings` secret columns with the env-fallback precedence preserved.
**Uses:** `cryptography` (Fernet/AESGCM), `httpx`, the existing `config.get_model_capability_async` 4-tier resolver.
**Implements:** the "discovery proposes, human confirms" pattern (never auto-enable native-tool capabilities); the round-trip-verified secrets save (never silently swallow a write error).

### Phase 3: Workflow file-input cluster — after Glean/Beam UX research gate
**Rationale:** FEATURES and ARCHITECTURE both note the operator explicitly directed Glean/Beam research to precede locking the Run-modal scope/upload UX (SEED-112); ARCHITECTURE further recommends an internal build order within the cluster — `fetch_document_file` (pure new read tool, lowest coupling) before `attach_skill_file` (a WRITE tool whose threat model becomes the reference pattern) before the two Run-modal surfaces (SEED-110 template upload + SEED-112 folder scope, which share one run-input channel and should ship together).
**Delivers:** `fetch_document_file` tool (KB→sandbox bridge, size-capped, owner-rescoped), `attach_skill_file` tool (agent→skill, owner-scoped only, no global/built-in write), a Run-modal upload control + editable folder-scope picker wired through `create_workflow_run.inputs`.
**Addresses:** Track 1 table-stakes and differentiators from FEATURES.md Part 3 (declared typed inputs, run-time file upload, user-selectable KB scope, RAG↔sandbox bridge).
**Avoids:** Pitfalls 4 (SSTI via broken provenance boundary), 5 (zip-bomb/MIME-spoofing), 6 (RAG→sandbox cross-user exfiltration), 7 (skill-attach as an ungated cross-tenant write surface).

### Phase 4: User-friendliness — inline citations, plain language, WCAG AA
**Rationale:** Inline citations touch the G-5 hot files (SSE stream, `MessageItem.tsx`) and are explicitly flagged G-2 sketch-first (live UI, "feels like"); WCAG AA audits best once the new admin + Run-modal surfaces from Phases 1–3 already exist. This is also the largest single-feature lift per FEATURES.md's prioritization matrix, so it benefits from landing last with the rest of the surface stable.
**Delivers:** inline per-claim citation markers (attribution keyed to the run's actual retrieval-set, never a post-hoc re-ask), the plain-language two-audience label layer extending Phase-124's two-door, an axe-automated + manual-keyboard WCAG AA pass across all net-new surfaces.
**Addresses:** Track 4 table-stakes from FEATURES.md Part 3 (universal industry convergence on inline markers + absence-as-signal).
**Avoids:** Pitfall 14 (fabricated/post-hoc citation attribution), Pitfall 15 (relabeling that breaks enum/audit/API contracts or the Deep-Mode byte-identical invariant).

### Phase Ordering Rationale

- **Dependency-driven, not just thematic:** ARCHITECTURE's explicit "suggested build order" places the operator boundary (Phase 1) before the model-registry write path (Phase 2) before any admin-gated write, which PITFALLS independently corroborates via the `require_operator`-first framing repeated across nearly every pitfall.
- **Cheapest-highest-value early:** the model registry (Phase 2) is sequenced early specifically because STACK and ARCHITECTURE both establish that its hard part (the read path, the discovery logic) is already done — it is the fastest visible win and de-risks the milestone's velocity.
- **Research-gated grouping:** Phase 3 is deliberately positioned after (or interleaved with) the operator-mandated Glean/Beam UX study for the Run-modal scope/upload controls, per the SEED-112 directive noted in both FEATURES and ARCHITECTURE.
- **Hot-file and sketch-first discipline last:** Phase 4 is sequenced last because it is the only track touching G-5 hot files under active ledger tracking (`MessageItem.tsx`, `StreamsProvider.tsx`) and requires a G-2 sketch gate — safer once the rest of the milestone's surfaces are stable and there's less concurrent churn on those files.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (workflow file-input cluster):** the operator has explicitly mandated Glean/Beam UX research as a precondition (SEED-112); the Run-modal scope-selector and upload-control shapes are not yet locked and should get a `/gsd:plan-phase --research-phase` or dedicated UX sketch pass.
- **Phase 4 (inline citations):** flagged by ARCHITECTURE as the largest single lift in the milestone, touching the SSE stream + G-5 hot files; needs a G-2 sketch-first pass before implementation, and the attribution-fabrication pitfall (14) needs its set-membership design nailed down before coding.
- **Secrets sub-phase (within Phase 2):** the choice between app-layer `cryptography` (recommended) and Supabase Vault has real environment-portability tradeoffs (self-hosted `VAULT_ENC_KEY` provisioning) that should be re-confirmed against the operator's actual self-host deployment targets before locking.

Phases with standard patterns (skip research-phase):
- **Phase 1 (operator foundation):** the `operator_users` + RLS + FastAPI-dependency shape is well-precedented in the codebase's own Supabase Auth + RLS patterns and confirmed against Supabase's own docs; no deep API research needed, mainly careful schema-shape discipline (Pitfall 3).
- **Phase 2 (model registry write UI):** the read path, discovery script, and table shape are all already live and verified with file:line citations; this is largely "write the UI over what exists."

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing-stack facts verified directly against live code + migrations (installed package versions, existing tables/routes); external facts (pgsodium deprecation, Supabase Vault, axe-core/eslint-jsx-a11y versions) verified against official Supabase/PyPI/npm sources, checked 2026-07. |
| Features | MEDIUM-HIGH | Internal/existing-app facts are HIGH (verified against milestone context + code). Competitor claims sourced from Glean's own current docs (HIGH) and Beam AI's marketing pages + third-party reviews (MEDIUM — thinner public documentation, glossy claims flagged explicitly). Cross-checks (Perplexity, Copilot, Dust, Onyx) are lighter-touch but corroborate the primary Glean pattern. |
| Architecture | HIGH | Every substrate claim verified against live code with file:line citations; the stale PRD's internals were explicitly treated as hypotheses and corrected against the codebase rather than trusted. |
| Pitfalls | HIGH | Grounded in the live codebase's own security boundaries (service-role client, provenance-routing engine selector, settings/secrets read path) cross-checked against project SEEDs and prior incident memory (case-sensitive MODEL_CAPABILITIES miss, silent settings-save failure). Generic file-security facts (SSTI/zip-bomb/path-traversal) are MEDIUM but well-established and verified against this codebase's own existing defenses. |

**Overall confidence:** HIGH

### Gaps to Address

- **Model-registry write mechanism (RLS write policy vs. service-role route):** ARCHITECTURE flags this as an open question — `model_capabilities_overrides` currently has read-only RLS (`model_overrides_read_all`); whether the write goes through a new RLS policy referencing `operator_users` or a service-role route behind the operator gate needs to be decided during Phase 2 planning.
- **SEED-112 scope-control shape (definition-time field vs. run-input selector vs. both):** explicitly blocked on the operator-mandated Glean/Beam research; FEATURES supplies strong directional guidance (Perplexity's 3-way toggle as the UX model) but the final control shape is not locked and should be a discuss-phase/sketch output, not assumed from this research.
- **Secrets backend choice (app-layer `cryptography` vs. Supabase Vault):** STACK recommends app-layer as default but explicitly frames Vault as a legitimate alternative depending on self-host deployment posture; confirm against actual deployment targets before Phase 2 implementation.
- **Install wizard / deployment-preset scope (SEED-003):** both FEATURES and ARCHITECTURE flag this as the milestone's biggest potential lift and a natural STRETCH/defer candidate; needs an explicit CORE/STRETCH/DEFER decision during requirements definition rather than being silently assumed out of scope.
- **Impersonation ("view as user") scope:** PITFALLS treats this as in-scope for Track 2 (Pitfall 2, dual-identity audit requirement) but FEATURES/ARCHITECTURE don't explicitly confirm it's a v3.3 CORE requirement vs. a nice-to-have; confirm during requirements whether "Sign in as user" ships this milestone or is deferred.

## Sources

### Primary (HIGH confidence)
- Live codebase (this session, file:line verified): `backend/app/dependencies.py:19`, `backend/app/models/user_settings.py`, `backend/app/config.py:498-701`, `backend/app/services/tool_dispatcher.py:248-276,707-960,1076-1123,3189`, `backend/app/services/template_render_service.py:381,416,657,936`, `backend/app/api/admin.py:21-72`, `backend/app/api/runs.py:1097`, `backend/app/api/skills.py:113-158`, `backend/app/api/documents.py:473-1074`, `backend/app/harness/scope.py`, `backend/app/harness/phase_types.py:300-359`, `backend/app/harness/emitters.py`, `supabase/migrations/053_settings_unification.sql`, `supabase/migrations/068_workspace_template_ephemeral.sql`, `supabase/migrations/071_dm_foundations.sql`, `frontend/src/components/workflows/WorkflowsPage.tsx:515-847`, `frontend/src/components/chat/ChatLayout.tsx:314`, `frontend/src/components/chat/MessageItem.tsx:442`, `backend/venv/Lib/site-packages` (installed package audit)
- Official docs: [Supabase pgsodium (deprecation)](https://supabase.com/docs/guides/database/extensions/pgsodium), [Supabase Vault](https://supabase.com/docs/guides/database/vault), [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac), [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [cryptography Fernet docs](https://cryptography.io/en/latest/fernet/), [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)
- [Glean docs](https://docs.glean.com/) — how agents work, knowledge source types, admin console, roles/permissions, agent governance, citations, file upload, pricing (current 2026, official)

### Secondary (MEDIUM confidence)
- [Beam AI](https://beam.ai/) marketing pages + [Capterra](https://www.capterra.com/p/10017154/Beam-AI/) / [skywork.ai](https://skywork.ai/skypage/en/Beam-AI-In-Depth:-Your-2025-Guide-to-Agentic-Process-Automation/1975589906492878848) reviews — thinner public docs than Glean, glossy claims noted
- [Perplexity Enterprise](https://www.perplexity.ai/hub/blog/introducing-internal-knowledge-search-and-spaces), [Dust docs](https://docs.dust.tt/docs/managing-datasources), [Onyx/Danswer GitHub+docs](https://github.com/onyx-dot-app/onyx) — lighter-touch cross-checks corroborating the primary Glean pattern
- File-validation best practices (magic bytes vs. Content-Type): multiple corroborating sources ([MIME/magic-bytes guide](https://zerotool.dev/blog/mime-type-lookup-guide/), [python-magic comparison](https://codecut.ai/python-magic-file-type-detection/))
- ClamAV self-hosting tradeoffs: [ClamAV docs](https://docs.clamav.net/), [antivirus-API comparison](https://www.attachmentscanner.com/blog/best_antivirus_api_malware_scanning_comparison)

### Tertiary (LOW confidence)
- [arXiv 2605.06635 "Cited but Not Verified"](https://arxiv.org/html/2605.06635v1) — citation-precision caution, single academic source, directionally used to justify precision-over-coverage in the inline-citation design (Pitfall 14)
- `.planning/PRDs/v3.2-operator-ux.md` — explicitly treated as a stale hypothesis document throughout; its business decisions (D-PRD-01..15) retained but its technical internals (§5/§6) are superseded by the live-code findings above

---
*Research completed: 2026-07-10*
*Ready for roadmap: yes*
