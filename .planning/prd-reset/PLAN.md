---
phase: prd-reset
phase_name: Milestone PRD Authoring (Meta-Phase)
status: planned
created: 2026-05-10
type: meta-phase
position: pre-milestone (runs BEFORE /gsd:new-milestone v2.6)
upstream_inputs:
  - .planning/research/milestone-shaping-2026-05-09.md  # synthesis (797 lines)
  - .planning/research/recovered/  # 15 recovered strategy MDs
  - .planning/seeds/  # 14 carry-forward seeds
  - .planning/codebase/  # current code map (refreshed 2026-05-09)
  - .planning/PROJECT.md  # validated requirements + decisions
  - .planning/MILESTONES.md  # shipped milestone history
  - graphify-out/GRAPH_REPORT.md  # current architecture graph
downstream_consumers:
  - /gsd:new-milestone v2.6  # consumes .planning/PRDs/v2.6.md as scope brief
  - /gsd:new-milestone v3.0  # consumes .planning/PRDs/v3.0.md
  - (and so on for v3.1, v3.2, v3.3, v3.4)
total_plans: 9
waves: 3
---

# Phase: Milestone PRD Authoring (Meta-Phase)

## Goal

Produce 6 PRDs — one per upcoming milestone (v2.6, v3.0, v3.1, v3.2, v3.3, v3.4) — that are fact-checked against current code, prune outdated content from the recovered strategy docs, surface ideas the synthesis didn't capture, and explicitly bound scope. Each PRD must be ready for `/gsd:new-milestone <version>` to consume directly without further interpretation.

## Why this phase exists (and why it sits before any milestone)

PRDs that scope multiple future milestones are an *input* to milestone selection, not an *output* of one. Authoring them inside (say) v2.6 forces v2.6 to retroactively justify why it was the right context for cross-milestone decisions. This meta-phase keeps the authoring decoupled — same shape as the pre-milestone research synthesis (`.planning/research/058-sse-concurrency-research.md` shipped before Phase 058 in v2.5).

It's also the moment to apply lateral thinking: "did I miss a feature? are old documents still valid? what's outdated? what's the leanest version that still wins?" — questions that get harder once milestone execution starts.

## Locked upstream decisions (binding inputs)

These decisions are LOCKED via `.planning/research/milestone-shaping-2026-05-09.md` user signoff 2026-05-10 + project memory `project_v3_roadmap_locked.md`. Plan 01 produces a canonical ADR doc that codifies them; subsequent plans MUST NOT re-litigate.

1. Target: mid-large enterprise with user-count flexibility
2. Posture: hybrid SaaS — co-tenant for SMB/mid + dedicated/on-prem for large enterprise
3. License: closed core (commercial EULA) + open peripherals (MCP server, client SDKs, agentskills.io standard)
4. Timing: feature-complete-when-feature-complete (no hard deadline)
5. Competitors: Glean (primary), M-Files + OpenAI Assistants (secondary)
6. Streams Provider (SEED-007): pre-emptive lift in v2.6
7. RAG quality: Docling-first (MIT, free); PyMuPDF AGPL fallback behind `PdfExtractor` abstraction; PyMuPDF Pro commercial license deferred until first paying customer
8. Multi-worker readiness: lift D-v2.5-02 in v2.6 (asyncpg + multi-worker discipline rewrite)
9. Skill Studio: full PRD per RECOVERED_SKILL_STUDIO_PRD.md (12-14 phases)
10. Pricing: 3-tier flat (Standard / Pro / Enterprise) per-named-user + add-ons (vertical packs, advanced governance, premium support)
11. Market shape: horizontal core + opt-in vertical packs (legal, finance, healthcare)

## Outputs (deliverables)

| Output | Path | Authored by |
|---|---|---|
| Decisions ADR | `.planning/prd-reset/DECISIONS.md` | Plan 01 |
| PRD template scaffold | `.planning/prd-reset/PRD-TEMPLATE.md` | Plan 02 |
| v2.6 PRD | `.planning/PRDs/v2.6.md` | Plan 03 |
| v3.0 PRD | `.planning/PRDs/v3.0.md` | Plan 04 |
| v3.1 PRD | `.planning/PRDs/v3.1.md` | Plan 05 |
| v3.2 PRD | `.planning/PRDs/v3.2.md` | Plan 06 |
| v3.3 PRD | `.planning/PRDs/v3.3.md` | Plan 07 |
| v3.4 PRD | `.planning/PRDs/v3.4.md` | Plan 08 |
| Cross-PRD consistency report + outdated-content prune validation + signoff | `.planning/prd-reset/SUMMARY.md` | Plan 09 |

## Wave-based plan structure

### Wave 0 — Foundation (parallel, 2 plans)

#### Plan 01 — Decisions ADR
**Output:** `.planning/prd-reset/DECISIONS.md`
**What:** Codify the 11 locked decisions in ADR-style entries (one per decision: Status / Context / Decision / Consequences / Date / Sources cited). Cross-link each to the synthesis section + memory file that introduced it. Include "decisions explicitly NOT made yet" appendix (e.g., specific add-on pricing per tier, exact target customer count for v2.6, vertical-pack ordering).
**Verification gate:**
- [ ] All 11 decisions present, each with Sources line citing synthesis section + commit `d7af056`
- [ ] No new decisions introduced (this plan codifies, does not extend)
- [ ] Cross-links to project memory `project_v3_roadmap_locked.md` valid

#### Plan 02 — PRD Template Scaffold
**Output:** `.planning/prd-reset/PRD-TEMPLATE.md`
**What:** Author the canonical PRD section structure that Plans 03-08 each clone and fill. Sections required:
1. Header (milestone version + name + 1-paragraph thesis)
2. Locked decisions inheritance (which DECISIONS.md rows apply)
3. Scope (themed bullet list, each tagged with seed-IDs / recovered-doc-IDs)
4. Requirements (Validated [empty at PRD time] / Active / Out of Scope) — mirrors PROJECT.md template
5. Architecture & Data Model changes (new tables, modified tables, new SDK / library deps, new env vars, schema-migration count estimate)
6. Compatibility check (every architectural change cites current code by file:line; explicitly states what compatibility constraint it satisfies — e.g., "must not violate D-v2.5-02 single-worker", "must integrate with run-backed streaming at backend/app/api/threads.py:158-255")
7. Scalability check (every new feature addresses: 10x users? 100x docs? bottleneck identified, bound stated)
8. Coverage check ("did I miss anything?" — explicit comparison against synthesis Section 4 clusters; what's NOT picked up + why)
9. Document validity check (which recovered MDs / seeds this PRD supersedes, archives, or carries forward unchanged)
10. Surprise-feature check (ideas considered but rejected — forces lateral thinking; minimum 3 entries)
11. Lean check ("what we're NOT doing in this milestone" — explicit out-of-scope list with rationale)
12. Phase outline (DAG-able phase list with dependencies)
13. Decisions to lock pre-execution (any one-way decisions surfaced during PRD authoring — added to DECISIONS.md before milestone starts)
14. Competitive positioning paragraph (names ≥2 specific competitors and ≥2 differentiators)
15. Carry-forward seeds (which seeds this PRD consumes / closes vs leaves planted)
16. Sources (every doc cited, every code file:line cited)

**Verification gate:**
- [ ] All 16 sections present in template
- [ ] Each section has a 1-line filling instruction (e.g., for §6: "For each new component or modified subsystem, list: code path being touched, file:line of integration point, compatibility constraint, mitigation if conflict")
- [ ] Template is annotated with examples drawn from prior milestones (PROJECT.md v2.2 / v2.3 / v2.5 entries)

### Wave 1 — Six PRDs (parallel, 6 plans)

Each PRD plan clones PRD-TEMPLATE.md and fills it for one milestone. All 6 are independent — no plan reads another plan's output. Plans 03-08 may run in parallel via worktree-isolated agents. Each plan applies the **6 verification gates** below.

#### Per-PRD verification gates (apply to all 6 PRDs)

**Gate 1: Compatibility check**
Every architectural change cites current code by file:line. Every new component lists what it integrates with (existing function / route / table / SSE event). Conflicts with locked architectural decisions (D-v2.5-01..D-v2.5-10) explicitly resolved or escalated for re-litigation.

**Gate 2: Scalability check**
Every feature addresses three load axes: concurrent users (10x), document corpus size (100x), parallel runs (50+). Bottleneck identified per axis. Bound stated (e.g., "scales linearly to 1000 concurrent users at single-worker → contradicts; requires SEED-001 multi-worker first").

**Gate 3: Coverage check**
Explicit walk through synthesis §4 theme clusters. For each cluster, state: included / partially included / deferred / out-of-scope. Justification per cluster. New ideas surfaced during PRD authoring captured here.

**Gate 4: Document validity check**
For each input doc (seeds + recovered MDs), state: still valid as-written / supersedes / archives / carries-forward-unchanged. Outdated content from synthesis §7 cross-referenced and either pruned or explicitly preserved with rationale.

**Gate 5: Surprise-feature check (≥3 entries)**
Ideas considered and REJECTED. Each entry lists: idea / why it's tempting / why we're not doing it now / re-trigger condition. Forces lateral thinking. The reviewer in Wave 2 verifies this list isn't trivial.

**Gate 6: Lean check**
"What we're NOT doing in this milestone" section is non-empty. Out-of-scope items mapped to: deferred to which later milestone / rejected entirely / awaiting decision. The reviewer verifies the lean list bounds scope reasonably (no kitchen-sink milestone).

#### Plan 03 — v2.6 PRD (Foundation: RAG Quality + Multi-Worker + Polish)
**Theme:** Production-ready substrate. Lift retrieval quality, lift D-v2.5-02 single-worker constraint, close planted bugs.
**Pulls in:** Cluster A (RAG quality — Docling spike + PDF/DOCX consistency + multimodal lift) + Cluster F (polish: SEED-008/009/010/011) + Cluster G opportunistic items + SEED-001 multi-worker work + SEED-007 pre-emptive Streams Provider lift.
**Key open questions to resolve in PRD:** Docling httpx<0.28 vs supabase 2.10 conflict — fix path to commit (upgrade supabase / pin httpx / subprocess isolation)? Multi-worker rollout strategy (asyncpg first → workers second, or atomic)? Confidence threshold recalibration after Docling — re-run or reuse Phase 32.5 calibration?
**Output:** `.planning/PRDs/v2.6.md`
**Estimated phase count this PRD will scope:** 12-15.

#### Plan 04 — v3.0 PRD (Skill Studio — full)
**Theme:** Iterative skill development + eval environment. Headline differentiator vs OpenAI Assistants / ChatGPT custom GPTs.
**Pulls in:** Cluster B (Skill Studio — RECOVERED_SKILL_STUDIO_PRD.md as primary input, RECOVERED_Episode4_PRD as v2.0 foundation reference, RECOVERED_Harnessing_Agents Opportunity B for multi-agent eval shape).
**Key open questions to resolve in PRD:** Resolve the 5 RECOVERED_SKILL_STUDIO_PRD open questions (sequential vs parallel eval execution, target-skill-only vs full catalog inject — collides with SKILL-01/02 tech debt, text vs file output, UI-driven test case creation in v1, skill versioning column). Migration starting number = 039+ (current head 038). Confirm POST-stream → run-backed-streaming pattern for eval SSE events.
**Output:** `.planning/PRDs/v3.0.md`
**Estimated phase count:** 12-14.

#### Plan 05 — v3.1 PRD (Operator UX + Deployment Flexibility)
**Theme:** Enterprise IT can deploy + operate without dev help. Required before first paid co-tenant customer.
**Pulls in:** Cluster C (admin shell + install wizard + RBAC operator role + secrets store + MODEL_CAPABILITIES editor + migration UI + deployment presets) + parts of SEED-001 (backpressure dashboard) + SEED-009 (max_tokens cap → MODEL_CAPABILITIES editor).
**Key open questions to resolve in PRD:** Operator role permission model (single super-admin vs RBAC tier above existing user roles)? Secrets store choice (env vars / Vault / Doppler / 1Password Connect)? Deployment presets — what tiers (Solo / Team / Enterprise)? On-prem packaging shape (single Docker compose / k8s helm / both)? RECOVERED_VPS_Deployment_Guide.md `--workers 2` correction baked in?
**Output:** `.planning/PRDs/v3.1.md`
**Estimated phase count:** 10-14.

#### Plan 06 — v3.2 PRD (Multi-Tenancy — Hybrid SaaS Foundation)
**Theme:** Org/dept/role primitives + RLS shift + SSO + audit. Load-bearing for hybrid SaaS posture.
**Pulls in:** Cluster E (SEED-004 entire) + RECOVERED_PRD_Enterprise_RAG_Features F-04 (precursor scope, superseded by SEED-004) + parts of SEED-005 Tier B (retention/approvals per dept become possible).
**Key open questions to resolve in PRD:** Isolation model — single Supabase instance with org_id discriminator + RLS / Supabase project per org / hybrid (free/standard tier shared, enterprise dedicated)? SSO provider scope (SAML / OIDC / both)? Org admin role hierarchy (super-admin / org-admin / dept-admin / member)? Migration path from existing single-tenant data (per-user → per-org assignment)? `match_document_chunks` SECURITY DEFINER RPC audit (CONCERNS.md:69-76).
**Output:** `.planning/PRDs/v3.2.md`
**Estimated phase count:** 10-12.

#### Plan 07 — v3.3 PRD (Open Platform: API + MCP + Service Accounts)
**Theme:** Versioned REST + MCP + service accounts + webhooks + rate limiting. Ecosystem play.
**Pulls in:** Cluster D (SEED-013 entire) + RECOVERED_Harnessing_Agents Opportunity D (MCP exposure) + dependency on SEED-001 for rate limits.
**Key open questions to resolve in PRD:** Auth model for service accounts (per-org bearer token / scoped JWTs / OAuth2 client credentials)? MCP server transport (stdio for desktop / HTTP for cloud / both)? Rate limiting tier (per-key / per-org / per-endpoint, token bucket on Redis)? CORS policy (currently localhost-regex per CONCERNS.md:543 — needs explicit allow-list per consumer)? SDK languages (Python + TypeScript v1)? Versioning strategy (`/api/v1/` URL prefix / Accept header)? Webhook delivery semantics (at-least-once + signed HMAC)?
**Output:** `.planning/PRDs/v3.3.md`
**Estimated phase count:** 10-12.

#### Plan 08 — v3.4 PRD (Automations & Routines + DM Tier B)
**Theme:** Scheduled / triggered / reactive runs + Document Mgmt Tier B (retention, check-in/out, approvals, lifecycle).
**Pulls in:** Cluster B partial (SEED-014 entire + RECOVERED_Harnessing_Agents Opportunity A — Background Research Agent) + SEED-005 Tier B (DM lifecycle features).
**Key open questions to resolve in PRD:** Scheduler choice (APScheduler / Celery beat / arq / custom on Redis)? Event bus (Redis Streams `events:*` namespace per SEED-014, or Postgres NOTIFY/LISTEN, or external like Kafka)? Long-running run checkpointing (RECOVERED_Harnessing_Agents Opportunity E — fold in or split out)? Spend caps (per-org / per-routine / per-run)? DM Tier B retention model (per-doc / per-folder / per-org policy)? Approval workflow shape (linear / parallel / conditional)?
**Output:** `.planning/PRDs/v3.4.md`
**Estimated phase count:** 10-12.

### Wave 2 — Consistency + Signoff (1 plan)

#### Plan 09 — Cross-PRD consistency pass + signoff
**Output:** `.planning/prd-reset/SUMMARY.md`
**What:**

A. **Cross-PRD consistency check.** For each adjacent pair of PRDs (v2.6↔v3.0, v3.0↔v3.1, ..., v3.3↔v3.4) plus key non-adjacent pairs (v2.6↔v3.2 multi-worker prereq, v3.2↔v3.3 service accounts inherit org, v3.0↔v3.4 skill execution in routines), verify:
- Dependencies declared in upstream PRD are honored downstream
- No two PRDs claim ownership of the same scope item
- No PRD assumes a feature that no PRD ships
- Schema migration ordering is internally consistent (each PRD's migration count adds up to a contiguous range starting at 039)

B. **Outdated-content prune validation.** For every entry in synthesis §7, verify ≥1 PRD's Document validity check (Gate 4) addresses it. Any unaddressed §7 entry is a gap; either escalate to a PRD owner or document why it stays unaddressed.

C. **Lateral-thinking pass — "what features did we miss?"**
Explicit checklist applied across all 6 PRDs:
- Real-time collaboration (multi-user editing same thread/skill/doc) — covered? where?
- Notification system (in-app + email + webhook) — where does this land?
- Audit log UI (audit_log table from v2.2 F-06 — has UI?) — where?
- Mobile native apps (iOS/Android) — covered or explicitly deferred?
- Accessibility (WCAG 2.1 AA compliance) — required for enterprise sales — where?
- Compliance certifications (SOC 2, ISO 27001, GDPR DPA) — sales-blocker work — where?
- Internationalization (multi-language UI + RTL support) — covered?
- Backup/restore UX (per-user export, per-org backup) — where?
- Disaster recovery + data retention policy — where?
- Cost tracking / usage telemetry per org / per user / per skill — where?
- Search across threads/messages (full-text, distinct from RAG over docs) — where?
- Thread sharing (read-only public/internal links) — where?
- Skill marketplace (agentskills.io infra as a service) — where?
- LLM cost optimization (caching, prompt compression, model routing by complexity) — where?
- Browser extension (highlight web → ingest) — where?
- A/B model comparison (D-2 from synthesis §6) — where?
- Multi-Agent Orchestration as Skill execution mode (D-4) — where?
- Agent Checkpointing for long runs (D-5) — where?

For each: confirm coverage location OR document deferral with re-trigger condition. The list above is non-exhaustive — Plan 09 must propose ≥3 additional features the synthesis did not surface, then re-evaluate same way.

D. **Signoff.** Generate executive summary table: 6 PRDs × scope summary × estimated phase count × competitive-positioning sentence. User signs off (or kicks back specific PRDs for revision).

**Verification gate:**
- [ ] Every §7 outdated-content row mapped to a PRD's Gate 4 entry
- [ ] No cross-PRD scope collision (each scope item owned by exactly one PRD or explicitly shared with hand-off declaration)
- [ ] Lateral-thinking checklist (≥21 features) walked; each marked covered/deferred/rejected
- [ ] ≥3 features surfaced beyond synthesis (proves Plan 09 wasn't a checkbox exercise)
- [ ] User signoff captured
- [ ] **§8 (Coverage) vs §9 (Document validity) split honored** — every PRD's §8 names theme **clusters** (forward-looking, from synthesis §4); §9 names input **docs** (backward-looking, from synthesis §7). No PRD has both sections naming the same orientation; no redundant content across the two.
- [ ] **§10 (Surprise-feature) vs §11 (Lean) split honored** — §10 entries show "considered, then rejected" with re-trigger condition (process check); §11 entries show out-of-scope routing (deferred-to-which-milestone / rejected-entirely / awaiting-decision). No item appears in both with same framing.
- [ ] **§4 Out-of-Scope rows ⊆ §11 Lean entries** — every Out-of-Scope row in any PRD's §4 has a matching §11 Lean entry with same wording, OR §11 explicitly cross-references §4 (no duplication).
- [ ] **No migration number collisions** — `MIGRATION-RESERVATIONS.md` table consulted; every PRD's claimed migration numbers fall within its reserved range; no two PRDs claim the same number.
- [ ] **§9 PARTIALLY-SUPERSEDES rows close cleanly** — for every §9 row marked PARTIALLY-SUPERSEDES, the un-superseded portion appears in §11 (deferred / rejected / awaiting) OR is marked carries-forward-unchanged with rationale. No partial-state row leaks unaddressed across PRDs.
- [ ] **Q-ID upgrades route correctly** — every PRD's §13 questions either stay open (clear "decided by user before {milestone phase}") or, if upgraded mid-pass, route to `D-PRD-NN` for cross-milestone scope or `D-v{X.Y}-NN` for milestone-confined scope (per PRD-TEMPLATE §13 instruction).

## Scope bounding — what this meta-phase is NOT doing

- **Not executing any milestone.** Outputs are PRDs only. No code changes, no schema migrations, no infrastructure changes. (`/gsd:new-milestone v2.6` consumes the PRD afterward.)
- **Not re-litigating the 11 locked decisions.** Plan 01 codifies; subsequent plans inherit. New decisions surfaced during PRD authoring get added to DECISIONS.md, not arguments restarted.
- **Not authoring vertical-pack PRDs.** v3.5+ vertical packs (legal, finance, healthcare) are reactive to customer wins; PRDs deferred until first vertical customer is real.
- **Not authoring `ROADMAP.md` for any milestone.** Each PRD lists a phase outline (Gate 12 of template) but the actual ROADMAP.md is generated by `/gsd:new-milestone <version>` from the PRD.
- **Not generating REQUIREMENTS.md per milestone.** REQUIREMENTS.md is `/gsd:new-milestone` output, not PRD output. The PRD's "Requirements (Validated / Active / Out of Scope)" section is the input.
- **Not running `/gsd:autonomous` to ship anything.** This is planning + writing only. User reviews PRDs in Plan 09 signoff before any milestone execution.

## Definition of done

- [ ] `.planning/prd-reset/DECISIONS.md` committed with 11 decision rows
- [ ] `.planning/prd-reset/PRD-TEMPLATE.md` committed with 16 sections
- [ ] `.planning/PRDs/v2.6.md` through `.planning/PRDs/v3.4.md` (6 PRDs) committed, each passing all 6 verification gates
- [ ] `.planning/prd-reset/SUMMARY.md` committed with consistency report + lateral-thinking checklist + ≥3 surfaced features beyond synthesis
- [ ] User signoff captured in SUMMARY.md
- [ ] No outstanding gaps in synthesis §7 outdated-content prune
- [ ] No cross-PRD scope collisions

## Next step after this phase

`/gsd:new-milestone v2.6` — consumes `.planning/PRDs/v2.6.md` as scope brief. Generates `.planning/v2.6/REQUIREMENTS.md` + `.planning/v2.6/ROADMAP.md` + opens v2.6 milestone for `/gsd:plan-phase` per phase.

## Approximate effort

- Plan 01 (DECISIONS): 1 plan, ~30 min — codification work
- Plan 02 (PRD-TEMPLATE): 1 plan, ~1 hour — careful template authoring
- Plans 03-08 (6 PRDs): 6 plans, ~2-4 hours each, parallelizable
- Plan 09 (consistency + signoff): 1 plan, ~2-3 hours — most rigorous lateral-thinking step

Total: 9 plans, ~12-25 hours of agent time, ~2-3 days of wall-clock at sustained pace.
