# PRD-Reset Decisions (ADRs)

This document codifies the 11 business-shape and roadmap decisions locked
2026-05-10 from the milestone-shaping synthesis. It is the canonical input to
the 6 milestone PRDs (v2.6 → v3.4) authored in `.planning/prd-reset/Plans 02-08`
and to `/gsd:new-milestone` thereafter.

**Plain-language summary (for vibe-coder context):** The user picked an
audience (mid-large enterprise), a delivery shape (hybrid SaaS — shared for
SMB/mid, dedicated/on-prem for big enterprise), an open/closed split (closed
agent core + open peripherals so the ecosystem can plug in), no hard deadline,
two reference competitors (Glean primary; M-Files + OpenAI Assistants
secondary), and a 6-milestone build order. Each ADR below pins one of those
calls down with full context, consequences, and what was rejected and why.

**Authoring metadata:**
- Author: Plan 01 of `.planning/prd-reset/PLAN.md` (PRD-reset meta-phase)
- Date: 2026-05-10
- Source-of-truth synthesis commit: `d7af056`
- Source-of-truth synthesis: `.planning/research/milestone-shaping-2026-05-09.md`
- Source-of-truth memory: `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_v3_roadmap_locked.md`
- Decision-makers: User (fhdmrd@gmail.com) + research synthesis
- Status discipline: ACCEPTED entries are inherited by all downstream PRDs and may not be re-litigated by Plans 02-08; new decisions surfaced during PRD authoring get ADDED here, not arguments restarted

**ADR-ID prefix convention:** `D-PRD-NN` distinguishes these business-shape
decisions from per-milestone architectural decisions (which keep the
`D-v2.5-NN`, `D-v2.6-NN`, etc. prefix tied to the milestone they were locked
in).

---

## D-PRD-01 — Target market: mid-large enterprise with user-count flexibility

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** n/a (first explicit target-market commitment for the project)

### Context

Up to v2.5 the project was self-described as a single-developer / vibe-coder
build with no committed target user (synthesis §9 Open Question 1 listed four
candidate user shapes — single-user, small team, mid-size org, mid-large
enterprise — with no commitment between them). The recovered strategy docs
were written across different audience assumptions: RECOVERED_Episode4_PRD
treats it as a single-user power tool; RECOVERED_PRD_Enterprise_RAG_Features
already tilts enterprise; RECOVERED_SCALABILITY_ROADMAP scopes Tier 1-4
without picking one.

A target had to be picked because milestone *ordering* depends on it: a
single-user audience would prioritize RAG quality and polish first; a small-team
audience would prioritize operator UX and deployment first; a mid-large
enterprise audience prioritizes governance, SSO, audit, and multi-tenancy
first. Without a commitment, every milestone's scope was contestable.

### Decision

The target customer is mid-large enterprise (hundreds to thousands of named
users per org), with user-count flexibility within that band — i.e. a single
deployed install must scale from a few hundred to several thousand users
without re-architecting. SMB and mid-market are addressable through the same
product on a different deployment posture (see D-PRD-02), but feature
prioritization is driven by the enterprise buyer profile.

### Consequences

**Positive:**
- Feature priority is now unambiguous: governance, SSO, audit, multi-tenancy, RBAC, deployment flexibility outrank single-user polish on the roadmap
- Aligns with project memory `project_target_scale.md` ("organizational scale, prefer scale-ready defaults, don't paint org-level into a corner")
- Gives Glean as a directly-comparable buyer profile (see D-PRD-05)

**Negative / trade-offs accepted:**
- Single-user / vibe-coder polish (small QoL bugs) gets bundled rather than dedicated milestones
- Some user-visible quality fixes (SEED-008, SEED-009) wait for v2.6 instead of shipping as standalone hotfixes
- Pricing and feature gating must be designed for organizational buyers, not individual self-hosters

**Architectural implications:**
- SEED-004 (Org/Department/Role multi-tenancy) becomes load-bearing — confirms D-PRD-02 below
- All future RLS policies must be designed membership-keyed, not strictly user-keyed
- SSO / audit / governance become first-class scope items rather than nice-to-haves
- Implication for v2.6 PRD: foundation work (multi-worker, RAG quality) must be scaled to enterprise-shape concurrency targets, not single-user benchmarks
- Implication for v3.2 PRD: multi-tenancy is a load-bearing milestone, not a deferred item

### Alternatives considered + why rejected

- **Single-user / personal-install primary target:** rejected — the project's existing investment in audit, RLS, multi-provider routing, and skills-as-shared-format only pays off at organizational scale; the current global memory `project_target_scale.md` already flagged this direction
- **Small team / 5-50 users primary target:** rejected — gives a soft middle that doesn't differentiate against existing tools (NotebookLM, ChatGPT Teams) and forfeits the governance/audit-driven competitive moat
- **Decline-to-commit / serve all sizes equally:** rejected — every prior milestone's scope was contestable for exactly this reason; commitment is the unblock

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 1
- Project memory: `project_v3_roadmap_locked.md` (row #1 of locked decisions table)
- Project memory cross-ref: `project_target_scale.md` (organizational-scale stance)
- Prior commit anchor: `d7af056`
- Code references: n/a (business-shape decision; no current code change)

---

## D-PRD-02 — Hybrid SaaS posture (co-tenant SMB/mid + dedicated/on-prem large enterprise)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** Defers SEED-004 §why-this-seed-avoids-doing-it-now ("isolated-vs-co-tenant decision is one-way; premature commitment is costly") — commitment is now made

### Context

Project memory `project_org_level_deferred.md` flagged the org-level
multi-tenancy direction (isolated single-org vs co-tenant SaaS) as the
highest-stakes one-way decision still open. Synthesis §9 Open Question 2 listed
four candidates: single-tenant only, co-tenant SaaS, hybrid (free co-tenant /
enterprise dedicated), or decline to commit. Every other strategic decision
(pricing, deployment presets, SSO scope, service-account auth, MCP transport)
either depends on this or has its option-space narrowed by it.

Industry patterns from M-Files, Glean, and Doxis (the synthesis's named
reference vendors) all use a hybrid posture: shared/co-tenant infrastructure
for SMB and mid-market price points, isolated/dedicated/on-prem deployments for
large enterprise customers with data-residency, regulatory, or sovereignty
requirements.

### Decision

Adopt a hybrid SaaS posture. Co-tenant for SMB/mid (single Agentic RAG
deployment serves multiple paying customer orgs sharing infrastructure with
RLS-based isolation); dedicated single-org installs (or on-prem) for large
enterprise customers and any customer with regulatory / sovereignty / VPC
requirements. The same codebase serves both deployment modes; the difference is
configuration (org-discriminator on/off, secrets store, identity provider
binding) not a fork.

### Consequences

**Positive:**
- Matches the named reference competitors (M-Files / Glean / Doxis) so buyer
  expectations transfer cleanly
- Enables a meaningful free or low-cost tier (co-tenant) without giving up the
  enterprise sales motion (dedicated / on-prem)
- One codebase, one deployment recipe matrix — no fork

**Negative / trade-offs accepted:**
- SEED-004 (Org/Department/Role multi-tenancy) becomes load-bearing for
  v3.2 — cannot ship co-tenant SaaS without it
- RLS policies must be re-keyed from `user_id = auth.uid()` to
  membership-based; every `SECURITY DEFINER` RPC needs audit
  (`match_document_chunks` flagged at CONCERNS.md:69-76)
- Operator UX (v3.1) must support both deployment modes from day one — install
  wizard, secrets store, deployment presets all need a co-tenant/dedicated
  branch
- Cross-org data leakage becomes the highest-severity bug class

**Architectural implications:**
- Every user-facing table's RLS policy will be rewritten in v3.2
- Service-role client usage (CONCERNS.md:36-47) must be audited — must NOT
  bypass org isolation
- The isolation model itself is still open (single Supabase + org_id + RLS vs
  Supabase project per org vs hybrid) — see "Decisions explicitly NOT made yet"
  appendix; v3.2 PRD must resolve
- Implication for v3.1 PRD: deployment presets must include both co-tenant and
  dedicated configurations
- Implication for v3.3 PRD: API service accounts must inherit org context from
  day one — cannot retrofit

### Alternatives considered + why rejected

- **Single-tenant only (each install = one org):** rejected — leaves no path
  to a free or affordable tier and forfeits the SMB/mid market entirely
- **Co-tenant only (no dedicated/on-prem option):** rejected — locks out the
  large-enterprise buyers who have data-residency or VPC requirements; that
  segment was named as the primary target in D-PRD-01
- **Decline to commit / defer SEED-004 indefinitely:** rejected — every
  downstream decision (pricing, SSO, service-accounts, deployment presets)
  needs this anchor; deferral has been costing months

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 2 + §6 row 1 + Cluster E (Multi-Tenancy & Org Model)
- Project memory: `project_v3_roadmap_locked.md` (row #2 of locked decisions table)
- Project memory cross-ref: `project_org_level_deferred.md` (decision was deferred until 2026-05-10)
- Prior commit anchor: `d7af056`
- Code references: `backend/app/dependencies.py:13-17` (Supabase singleton — service-role client audit point), `backend/app/database/rpc.py` containing `match_document_chunks` (RLS-bypass via SECURITY DEFINER — CONCERNS.md:69-76)

---

## D-PRD-03 — Closed core (commercial EULA) + open peripherals (MCP server, client SDKs, agentskills.io ZIP standard)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** Synthesis §9 Open Question 3 ("Open-source-first / Open-core / Closed-source paid + hosted") — selects an open-core variant

### Context

Three license postures were on the table: full open-source, open-core (most
features OSS, advanced features paid), and closed-source. Each has a different
ecosystem story. Open-source-first maximizes adoption but caps revenue; closed
maximizes revenue capture but loses ecosystem leverage; open-core gives both
*if* the open/closed split lands on the right line.

The strongest ecosystem leverage points are not the agent core itself — they
are the *interoperability surfaces* (MCP server so Claude Desktop / Cursor /
other harnesses can connect; client SDKs so customers can integrate into their
apps; the agentskills.io ZIP standard so skills are portable). Those are
adoption-amplifiers, not product moats. The product moat is the agent core
itself — the multi-provider router, the run-backed streaming architecture, the
skills runtime, the RAG quality, the eval environment.

### Decision

Closed core under a commercial EULA, with permissively-licensed open
peripherals. Specifically:

- **Closed (commercial EULA):** the agent backend, frontend, runtime, eval
  environment, multi-tenancy, governance, automations
- **Open (permissive license, e.g. MIT or Apache-2.0):** the MCP server
  (so other harnesses can connect without a commercial dep), the client SDKs
  (Python + TypeScript v1), and the agentskills.io ZIP-format specification +
  reference tooling

This is a "standards play for the ecosystem; protect the agent core" posture.

### Consequences

**Positive:**
- Customer apps and developer harnesses (Claude Desktop, Cursor, third-party
  agents) can integrate via permissively-licensed MCP and SDKs without
  legal review of a commercial EULA
- agentskills.io as an open standard creates skill portability and a
  marketplace surface that no closed competitor can match
- Agent core stays closed so the product can be sold (matches D-PRD-01
  enterprise-buyer profile)

**Negative / trade-offs accepted:**
- Forfeits the "fully open-source self-hosted" badge that some
  prospect-segments (academic, OSS-purist enterprises) require
- Open peripherals must be maintained as truly portable — MCP server cannot
  silently depend on closed-core internals
- Licensing review needed before each public release: no AGPL or
  commercial-only deps may be linked into open peripherals

**Architectural implications:**
- MCP server (v3.3 scope) must be a clean process boundary against closed core
  — talks via REST or WebSocket only, no shared internal modules
- Client SDKs (v3.3 scope) must be generated against the public OpenAPI spec,
  not against internal Pydantic models
- v2.6 RAG-quality lift CANNOT take a hard dep on AGPL libraries (PyMuPDF
  default license) without isolation — see D-PRD-07
- agentskills.io standard already exists in repo (`SKILL.md` frontmatter +
  ZIP round-trip shipped v2.0 Phase 13) — needs to be split into its own
  permissively-licensed spec doc

### Alternatives considered + why rejected

- **Full open-source under permissive license:** rejected — gives away the
  product moat with no clear capture mechanism for the enterprise buyer
- **Full open-source under AGPL:** rejected — viral copyleft poisons every
  enterprise integration and makes a hosted offering legally awkward
- **Fully closed (no open peripherals):** rejected — surrenders the ecosystem
  leverage; a closed MCP server is just an integration nobody chooses to use
- **Open-core with paid features inside the same binary (e.g. enterprise auth
  module behind a license key):** rejected — operationally messy and harder
  to enforce than a clean closed-core / open-peripherals split

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 3 + §6 row 1 (self-hostable agentic-RAG-as-a-platform) + §6 row 9 (agentskills.io standard)
- Project memory: `project_v3_roadmap_locked.md` (row #3 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: `backend/app/api/skills.py` (existing skills system), repo-root `agentskills.io` ZIP-format reference (PROJECT.md:75 — "open standard for skill portability shipped v2.0")

---

## D-PRD-04 — Timing: feature-complete-when-feature-complete, no hard deadline

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** n/a

### Context

Synthesis §9 Open Question 4 asked whether any internal demo, launch,
partnership, or customer commitment was driving milestone timing. A hard date
forces small fast milestones (synthesis Option A profile); no hard date allows
the safer option of doing each milestone properly without trimming scope to
fit a calendar.

The project has run at v2.x cadence (one milestone every ~2-4 weeks) since
2026-Q1, shipped via /gsd:autonomous and human review. Adding a hard external
deadline now would compress that cadence and force scope cuts that the
roadmap doesn't otherwise need.

### Decision

No hard external deadline. Milestones ship when feature-complete and verified.
The 6-milestone roadmap (v2.6 → v3.4 = ~70 phases / 4-5 quarters at v2.5
velocity) is a planning estimate, not a commitment. Individual phases inside
a milestone keep their normal verification gates.

### Consequences

**Positive:**
- Each milestone can absorb its full scope without late-stage scope cuts
- Quality gates (UAT, code review, eval-review) stay non-negotiable
- Permits the "ship all, no deferring" SEED-007 posture (see D-PRD-06)
- Permits the larger Skill Studio scope (12-14 phases) without trimming
  (see D-PRD-09)

**Negative / trade-offs accepted:**
- No external pressure to force prioritization arguments to closure — must
  rely on roadmap discipline and the 11 locked decisions to avoid drift
- Slower revenue ramp than a deadline-driven launch
- If a real deadline materializes (partnership / customer commit / market
  event), this decision must be re-litigated — explicit re-trigger condition

**Architectural implications:**
- Permits proper architectural lifts (e.g. lifting D-v2.5-02 single-worker
  via asyncpg in v2.6 — see D-PRD-08) instead of patching around them
- Permits Skill Studio's full eval environment instead of a trimmed v1
  (see D-PRD-09)

### Alternatives considered + why rejected

- **Quarterly external milestones with public dates:** rejected — no
  partnership or customer commit is currently driving such a date; manufacturing
  one would force scope cuts the roadmap doesn't need
- **Internal demo deadline (e.g. ship v2.6 in 4 weeks):** rejected — current
  v2.5 cadence already ships at that pace organically; adding the
  deadline-as-rule forfeits the option to take longer when a phase needs it
- **Hard date for v3.0 only (Skill Studio public-launch event):** rejected —
  premature; revisit when a launch venue or partnership emerges

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 4 + §5 Option A risk profile
- Project memory: `project_v3_roadmap_locked.md` (row #4 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: n/a

---

## D-PRD-05 — Primary competitor Glean; secondary M-Files + OpenAI Assistants

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** Synthesis §6 listed 8 candidate competitors; this picks 3

### Context

Synthesis §6 listed 8 candidate competitor reference points (NotebookLM,
ChatGPT custom GPTs + Tasks, Glean, M-Files, Cursor MCP, Claude Desktop MCP,
Copilot Studio, n8n, Mem, Lindy, OpenAI Assistants). Each has a different
buyer profile and a different feature surface. Without picking 1-2 anchors,
the §6 differentiator list is generic; pinning a competitor sharpens which
3-4 differentiators get prioritized vs nice-to-have.

For the mid-large enterprise audience picked in D-PRD-01, three reference
points stand out for distinct reasons:

- **Glean** has the closest buyer profile match (enterprise knowledge search
  + agent layer, sold to IT)
- **M-Files** has the deepest document-management feature surface
  (check-in/out, retention, approvals, lifecycle) that a vertical-pack
  customer would compare against (see D-PRD-11)
- **OpenAI Assistants** is the canonical reference for the agent capability
  surface (custom instructions, tools, code interpreter, file search) that
  Skill Studio differentiates against

### Decision

- **Primary competitor: Glean.** Buyer-profile match. Feature parity targets
  drive v3.1 (operator UX), v3.2 (multi-tenancy + SSO + audit), v3.3 (open
  platform), and the governance dashboard direction
- **Secondary competitor 1: M-Files.** Document-management feature parity
  reference — drives v3.4 DM Tier B scope (retention, check-in/out, approvals,
  lifecycle) and the SEED-005 Tier A roadmap inside v2.6
- **Secondary competitor 2: OpenAI Assistants.** Agent-capability parity
  reference — drives v3.0 Skill Studio scope (eval environment + iterative
  skill dev as the headline differentiator); also reference for v3.4
  automations (vs ChatGPT Tasks)

### Consequences

**Positive:**
- Differentiator selection is now sharp: Skill Studio + open MCP + multi-provider
  routing + run-backed streaming all hit at least one of these three
- Sales positioning has named reference points buyers know
- PRD competitive-positioning gates (Plans 03-08 Gate 1 and Wave-2 review) have
  a concrete checklist to grade against

**Negative / trade-offs accepted:**
- Defocus risk: NotebookLM (RAG quality benchmark), Lindy (automations
  benchmark), Copilot Studio (Microsoft ecosystem) are still real but
  deprioritized for naming
- Buyer conversations may surface "but you also need to beat NotebookLM at
  RAG quality" — that's still required (see D-PRD-07) but isn't the framing
  for sales

**Architectural implications:**
- Implication for v2.6 PRD (RAG quality): must hit NotebookLM-level multimodal
  extraction even though NotebookLM isn't named — see D-PRD-07 Docling-first
- Implication for v3.0 PRD (Skill Studio): must visibly out-feature OpenAI
  Assistants on iterative dev + eval — pushes the "full PRD, no trimmed v1"
  decision (D-PRD-09)
- Implication for v3.1 + v3.2 PRDs (Operator UX + Multi-tenancy): must match
  Glean on SSO, audit, deployment flexibility, governance dashboard
- Implication for v3.4 PRD (DM Tier B): must match M-Files on retention,
  check-in/out, approvals, lifecycle for vertical-pack viability

### Alternatives considered + why rejected

- **NotebookLM primary:** rejected — strong RAG/multimodal but consumer-shaped
  buyer profile; doesn't pull governance/audit/SSO scope
- **ChatGPT custom GPTs + Tasks primary:** rejected — proprietary ecosystem;
  matching it doesn't differentiate, only catches up
- **Copilot Studio primary:** rejected — locks the comparison to Microsoft
  ecosystem buyers, narrowing the addressable market
- **n8n / Lindy primary (workflow automation):** rejected — workflow surface
  alone, missing the RAG and skills core that's already shipped
- **No competitor anchor / "we're our own category":** rejected — buyers
  always frame against an existing tool; not picking one means they pick for us

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §6 (full table) + §9 Open Question 5
- Project memory: `project_v3_roadmap_locked.md` (row #5 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: n/a

---

## D-PRD-06 — SEED-007 Streams Provider lift is pre-emptive (Phase 0 of v2.6)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** SEED-007 status moves from "dormant — defer until trigger" to "active — schedule pre-emptive lift in v2.6"

### Context

SEED-007 (App-level Streams Provider) targets the 1229-LOC `useMessages.ts`
single-buffer architecture (CONCERNS.md:118-125). The current single-buffer
shape works for one chat surface at a time; it breaks the moment a second
concurrent stream surface lands (eval streams alongside chat in Skill Studio,
split-view, multi-pane).

Synthesis §9 Open Question 6 framed two options:

- Lift it as Phase 0 of Skill Studio (mechanical refactor, ~3-5 plans) — clean
  foundation for eval streams and any future split-view work
- Defer until first concurrent-stream surface forces the lift — smaller diff
  now, larger diff later

Plus a "ship all, no deferring" instinct from the user — i.e. take the
slightly-larger-now pre-emptive path so the rest of the roadmap doesn't have to
work around the single-buffer constraint.

### Decision

Pre-emptive lift. SEED-007 is scheduled into v2.6 (the foundation milestone),
NOT v3.0 Skill Studio. v2.6 PRD owns SEED-007 Phase 0 of v2.6's phase
sequence. v3.0 Skill Studio inherits a clean multi-stream substrate.

### Consequences

**Positive:**
- v3.0 Skill Studio's eval-stream UX gets a clean substrate from day 1 —
  no mid-milestone refactor risk
- Future split-view / multi-pane / multi-tab features land cheaper
- Aligns with the user-stated "ship all, no deferring" posture

**Negative / trade-offs accepted:**
- v2.6 carries an extra 3-5 plans of refactor work that doesn't itself deliver
  user-visible features
- Risk of refactor regression on the v2.5 run-backed streaming code paths —
  v2.6 PRD must include verification that current chat behavior is unchanged

**Architectural implications:**
- v2.6 phase outline must list SEED-007 Phase 0 as an explicit phase
- v3.0 Skill Studio PRD can assume `streamsProvider` exists; eval-stream UX
  designs against the new shape directly
- Frontend-only lift (no backend changes); D-v2.5-08 run-backed streaming
  remains the substrate
- Implication for v2.6 PRD: a regression-test gate on existing chat streaming
  is mandatory before merging the SEED-007 phase

### Alternatives considered + why rejected

- **Defer to v3.0 Skill Studio Phase 0:** rejected per user's "ship all, no
  deferring" stance and to avoid Skill Studio carrying the refactor risk
- **Defer until trigger (concurrent-stream surface forces it):** rejected —
  the trigger IS Skill Studio; deferring just means landing it during the
  most-load-bearing milestone
- **Skip entirely (live with single-buffer):** rejected — multi-pane / eval
  streams / split-view are all explicit downstream needs

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 6 + §2 SEED-007 row + Cluster B (Skill Studio + Streams Provider lift)
- Project memory: `project_v3_roadmap_locked.md` (row #6 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: `frontend/src/hooks/useMessages.ts` (1229 LOC single-buffer; SEED-007 target — CONCERNS.md:118-125)

---

## D-PRD-07 — RAG quality: Docling-first (MIT) + PyMuPDF AGPL fallback behind PdfExtractor abstraction; PyMuPDF Pro deferred until first paying customer

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** SEED-006 §pitfalls flagged PyMuPDF AGPL as a license problem; SEED-006 §Docling deferred Docling due to httpx<0.28 vs supabase 2.10 conflict — this decision selects Docling as primary anyway, contingent on resolving that conflict in a v2.6 spike

### Context

Synthesis §9 Open Question 7 posed three license postures for the multimodal
extraction lift (SEED-006): accept PyMuPDF AGPL for personal/internal use,
buy a commercial PyMuPDF Pro license, or defer the lift until decided. The
user stated explicitly they will not pay licensing fees during dev.

Project memory `project_seed006_multimodal_quality.md` records that Docling
was deferred as the primary path due to a httpx<0.28 vs supabase 2.10 conflict
(CONCERNS.md:680-685). However Docling's license (MIT, IBM-maintained,
production-grade quality) cleanly solves the license + quality combination if
the httpx conflict can be resolved.

PyMuPDF Pro (commercial) is the cleanest license-respecting alternative but
costs money — out of scope until a paying customer justifies the spend.

### Decision

Docling-first. Specifically:

1. Spike Docling integration in the FIRST plan of v2.6 to resolve the
   httpx<0.28 vs supabase 2.10 conflict (resolution paths to evaluate:
   upgrade supabase past the httpx pin, pin httpx<0.28 if compatible,
   subprocess isolation for Docling)
2. Behind a `PdfExtractor` abstraction so the primary path is swappable.
   Default in v2.6: Docling. Fallback: PyMuPDF AGPL (acceptable for personal
   /internal use posture pre-commercial-launch)
3. PyMuPDF Pro (commercial license) is NOT purchased now. Re-trigger
   condition: first paying customer signs (then license cost is justified
   and the swap happens via the existing `PdfExtractor` abstraction with
   no app code changes)
4. pypdf + python-docx remain the legacy default until v2.6 ships the
   replacement (`Keep pypdf + python-docx (not Docling)` row in PROJECT.md
   Key Decisions gets superseded by this ADR when v2.6 lands)

### Consequences

**Positive:**
- License-clean primary path during dev (Docling MIT)
- Cleanest quality path on the table (Docling state-of-the-art tables / formula
  / structured output)
- `PdfExtractor` abstraction makes the future PyMuPDF Pro swap trivial
- Solves SEED-006 §pitfalls AGPL concern without spending money

**Negative / trade-offs accepted:**
- Docling httpx conflict resolution is a real spike risk — if all three
  resolution paths fail, Docling can't ship and the AGPL fallback becomes
  primary (with all the AGPL friction that implies for closed-core distribution
  per D-PRD-03)
- Multimodal extraction quality lift is gated on the spike outcome — v2.6
  scope contingent
- Confidence threshold recalibration done in Phase 32.5 (project memory
  `project_phase32_5_chunking_fixes.md`) may need re-running after extractor
  swap

**Architectural implications:**
- New `PdfExtractor` Python abstraction in `backend/app/services/`
- New dep: docling 2.92+ (MIT)
- Removes default dep on pypdf for new ingests once Docling is primary
- Affects: ingestion pipeline, multimodal_service.py (CONCERNS.md:289-291),
  document chunk extraction, table/figure indexing
- Implication for v2.6 PRD: Plan 1 is the Docling spike; Plan 2+ is contingent
- Implication for D-PRD-03 (closed-core / open-peripheral split): if AGPL
  fallback ends up being the only option, it cannot be linked into open
  peripherals — must be subprocess-isolated to avoid copyleft contamination
- Implication for distribution: AGPL fallback path requires audit before any
  closed-source binary ship

### Alternatives considered + why rejected

- **PyMuPDF AGPL as primary, accept license risk:** rejected — copyleft viral
  on closed-source binary distribution (per D-PRD-03)
- **PyMuPDF Pro commercial license now:** rejected — user explicitly will not
  pay during dev
- **Stay on pypdf + python-docx, defer the lift:** rejected — leaves SEED-006
  RAG-quality complaints unfixed (~5% of visible figures stored on a 4 MB
  thesis) and forfeits the §6 row 7 differentiator vs NotebookLM
- **Build custom PDF extractor:** rejected — multi-month project, doesn't
  match existing OSS quality
- **OpenAI / Anthropic vision-API extraction at ingest time:** rejected —
  per-document cost is unbounded; also doesn't solve the table-structure
  problem the same way

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 7 + Cluster A (RAG Quality & Multimodal Depth) + §6 row 7 + §7 (RECOVERED_RAG_Quality_Investigation_Report Problem 3 still open)
- Project memory: `project_v3_roadmap_locked.md` (row #7 of locked decisions table)
- Project memory cross-ref: `project_seed006_multimodal_quality.md` (Docling deferral, httpx conflict), `project_phase32_5_chunking_fixes.md` (confidence threshold recalibration baseline)
- Prior commit anchor: `d7af056`
- Code references: `backend/app/services/multimodal_service.py:29-33` (`_MAX_VISION_CALLS=20`, `_MAX_B64_BYTES=512KB` — CONCERNS.md:289-291), CONCERNS.md:680-685 (Docling httpx conflict)

### Appendix — Q-v2.6-06 closure: PyMuPDF AGPL fallback license posture (Phase 069)

**Closes:** Q-v2.6-06 (PRD v2.6 §13, line 433)
**Authored:** 2026-05-13 (Phase 069 — `PdfExtractor` Abstraction Scaffold)
**Status:** APPENDED to D-PRD-07; documentation only.

The `PdfExtractor` abstraction (Phase 069) creates the seam; Phase 071 will plug
PyMuPDF as the AGPL fallback alongside Docling-primary. Before that wire-in
happens, the license posture must be locked in writing.

**Facts:**

- **PyMuPDF (`pymupdf>=1.24`) is AGPL-3.0.** This is the upstream Artifex license.
  AGPL's copyleft and network-use triggers fire when AGPL code is linked into a
  distributed work.

- **D-PRD-03 ("closed core + open peripherals") forbids linking AGPL code into the
  open peripherals.** The MCP server, SDKs, and any future open-source client
  components are MIT/Apache-licensed; an AGPL link would force the closed core's
  source disclosure obligation onto code paths we do not want to publish.

- **Subprocess fence is the mechanism.** PyMuPDF runs as a separate OS process
  (its own Python interpreter, its own memory space) and communicates with the
  closed core via stdio / IPC over bytes. AGPL's linking trigger does NOT fire
  across a subprocess boundary — only across an in-process link (`import pymupdf`
  or a shared-library load). The closed core consumes PyMuPDF's output as data,
  not as a linked library.

- **Dev / personal-use posture today: AGPL acceptance is fine.** No external
  network users are served by the dev environment; no closed-core binary is
  distributed; the closed-core `PdfExtractor` consumer can simply `import pymupdf`
  in-process during dev without triggering the redistribution obligation. This
  mirrors how the project ran pre-Phase 069 with no commercial pressure.

- **Before any commercial redistribution that links PyMuPDF:** one of
  (a) **keep the subprocess fence intact** — the closed core ships without
      `import pymupdf` anywhere; the PyMuPDF subprocess is shipped as a separate
      binary or invoked from a separate `pip install pymupdf` env on the host
      (AGPL ships disclosed at the subprocess level only); OR
  (b) **acquire PyMuPDF Pro (commercial license from Artifex)** — removes the
      AGPL obligation entirely; deferred to first paying customer per D-PRD-07
      ("PyMuPDF Pro is NOT purchased now. Re-trigger condition: first paying
      customer signs").

- **Phase 069 scope:** documentation only. No `pymupdf` in `requirements.txt`.
  No subprocess fence implementation. No `PyMuPDFExtractor` skeleton in
  `extraction_service.py`.

- **Phase 071 scope:** wires `PyMuPDFExtractor` behind the `PdfExtractor` ABC,
  implements the subprocess fence per (a) above, and treats Docling (MIT) as the
  primary path. The `EXTRACTOR_PRIMARY` env var + per-document fallback (RAG-DOCLING-01)
  surface the AGPL fallback choice operationally.

**Re-trigger conditions for re-litigation:**

- First paying customer signs → re-evaluate path (b) PyMuPDF Pro purchase.
- Subprocess fence breaks for performance / latency reasons in Phase 071 → must
  formally supersede this appendix (path (a) is the contract; can't be quietly
  moved in-process).
- Artifex changes PyMuPDF license terms → re-read the upstream license + revisit.
- Closed-core distribution moves to a model that links PyMuPDF in-process before
  a Pro license is acquired → blocked by this appendix; must be re-decided.

---

## D-PRD-08 — Multi-worker readiness: lift D-v2.5-02 in v2.6 (asyncpg + multi-worker discipline)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** D-v2.5-02 (single uvicorn worker discipline) — this ADR schedules its lift; D-v2.5-02 remains the rule UNTIL v2.6's multi-worker work ships

### Context

D-v2.5-02 (locked 2026-05-02) mandates a SINGLE uvicorn worker because
`--workers N` masks concurrency bugs and breaks in-memory state (PROJECT.md:227).
This was the right call for v2.5 but is incompatible with the production
posture required for D-PRD-01's mid-large enterprise audience: a single worker
caps concurrent users by the AnyIO threadpool (currently 200, raised in
Phase 058 D-058-01).

SEED-001 (Scale Readiness) has long carried the "asyncpg + multi-worker"
discipline rewrite as the path forward. Synthesis §9 Open Question 8 framed
three trigger points: now (v2.6), when public API ships (Phase 0 of v3.3), or
when telemetry shows AnyIO saturation. Three downstream constraints push it
forward:

- v3.3 Open Platform (public API + MCP) is unsafe on a single worker — public
  traffic can DoS it trivially
- v3.4 Automations & Routines is unsafe on a single worker — concurrent
  scheduled runs saturate the threadpool
- RECOVERED_VPS_Deployment_Guide.md still reads `--workers 2` (must be
  corrected either way — synthesis §7)

Lifting D-v2.5-02 also means rewriting the supabase-py wrap pattern
(D-v2.5-01) — `aexec` is a tactical workaround; asyncpg is the proper async
Postgres driver.

### Decision

Lift D-v2.5-02 in v2.6 (the foundation milestone). v2.6 owns:

- asyncpg integration (replace blocking supabase-py calls inside async handlers
  with asyncpg or supabase-py-async equivalents)
- Multi-worker discipline rewrite (any in-memory state that can't survive
  worker boundaries gets moved to Redis or Postgres)
- Updated runbook (RECOVERED_VPS_Deployment_Guide.md `--workers 2` line gets
  corrected to N-worker discipline post-v2.6)
- Production-default: `--workers N` where N is configurable (typically
  `2 * CPU` per uvicorn convention)

D-v2.5-02 status flips from "ACCEPTED" to "SUPERSEDED by D-PRD-08" once v2.6
ships. The single-worker rule is in force in the meantime.

### Consequences

**Positive:**
- Unblocks v3.3 (public API) and v3.4 (automations) safely
- Closes the runbook contradiction (synthesis §7 — RECOVERED_VPS_Deployment_Guide
  `--workers 2` line)
- Removes the AnyIO 200 concurrent-user cap as the production bottleneck

**Negative / trade-offs accepted:**
- v2.6 now carries an architecture-shift phase (asyncpg + multi-worker) on
  top of RAG quality + Streams Provider — biggest milestone
- Concurrency bugs that the single-worker rule masked may surface (the exact
  reason D-v2.5-02 existed); v2.6 PRD must include a stress-test gate
- D-v2.5-01 `aexec` wrap pattern may need to be removed or
  re-purposed — careful migration path required

**Architectural implications:**
- Replace `supabase-py` blocking-call sites with asyncpg or supabase-py-async
  (every `aexec(...)` call site needs review)
- Any module-level singleton with mutable state must be audited
  (`backend/app/dependencies.py` Supabase singleton — CONCERNS.md:36-47;
  Redis singleton; LangSmith client; etc.)
- Run-task registry (Phase 067.x) must work cross-worker — likely Redis
  Streams `runs:active` ZSET is already cross-worker safe (decision D-v2.5-08
  picked Redis Streams partly for this), but every read/write site needs audit
- Implication for v2.6 PRD: stress-test gate against pre-existing concurrent
  read/write paths
- Implication for v3.3 PRD: rate limiting can be Redis-token-bucket
  cross-worker safe from day 1
- Implication for v3.4 PRD: scheduler can run as a sibling worker process

### Alternatives considered + why rejected

- **Defer to Phase 0 of v3.3 (Open Platform):** rejected — v3.3's public API
  cannot ship safely without it; doing it inside v3.3 means the milestone
  carries both architecture risk AND public-traffic risk simultaneously
- **Defer until telemetry shows AnyIO saturation:** rejected — production
  D-PRD-01 enterprise customers will hit this faster than test telemetry
  surfaces it; reactive lift is more expensive
- **Skip asyncpg, just lift `--workers N` with current supabase-py:** rejected
  — supabase-py blocking calls inside async handlers (D-v2.5-01) are still
  the root cause of the threadpool saturation; multi-worker without asyncpg
  is just a bigger threadpool, not a fix

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 8 + Cluster C (Operator & Deployment Productization, code-readiness conflict) + §2 SEED-001 row
- Project memory: `project_v3_roadmap_locked.md` (row #8 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: `backend/app/dependencies.py:13-17` (Supabase singleton, CONCERNS.md:36-47), Phase 058 D-058-01 (AnyIO threadpool 200 ceiling — STACK.md:122), `backend/app/api/threads.py:158-255` (`_drain_stream_with_close_on_cancel` cross-worker safety review point)

---

## D-PRD-09 — Skill Studio: full PRD per RECOVERED_SKILL_STUDIO_PRD.md (12-14 phase milestone)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** Synthesis §9 Open Question 9 ("Implement RECOVERED_SKILL_STUDIO_PRD.md as a 12-14 phase milestone" vs "Trim to v1 minimum")

### Context

Synthesis §9 Open Question 9 framed two scoping options:

- Implement RECOVERED_SKILL_STUDIO_PRD.md as a 12-14 phase milestone (full
  iterative skill dev + eval environment)
- Trim to v1 minimum (eval cases + run_skill_eval + Evals panel only); defer
  dual-execution streaming to v3.0.5

Skill Studio is the headline differentiator vs OpenAI Assistants and ChatGPT
custom GPTs (per D-PRD-05). A trimmed v1 lands faster but ships without the
features that ARE the differentiator (iterative dev loop, dual-execution
streaming, full eval surface).

The "ship all, no deferring" stance from D-PRD-06 applies here too. Plus
Phase 065 (combined skills test infra) shipped 26/26 pass — the foundation is
clean.

### Decision

Full PRD per RECOVERED_SKILL_STUDIO_PRD.md (with §7 corrections applied). v3.0
is a 12-14 phase milestone (per the recovered PRD's own scoping). No trimmed
v1. SEED-007 lift (D-PRD-06) is the prerequisite Phase 0 — already locked into
v2.6 — so v3.0 inherits a clean multi-stream substrate.

5 open questions inside RECOVERED_SKILL_STUDIO_PRD.md (sequential vs parallel
eval execution; target-skill-only vs full catalog inject — collides with
SKILL-01/02 tech debt; text vs file output; UI-driven test case creation in
v1; skill versioning column) are NOT pre-decided here — they're resolved
during /gsd:discuss-phase for the v3.0 milestone (see "Decisions explicitly
NOT made yet" appendix).

### Consequences

**Positive:**
- Headline differentiator vs OpenAI Assistants ships fully formed
- Eval environment becomes a real iterative-dev surface — competitive moat
- Resolves SKILL-01/02 catalog full-inject tech debt (PROJECT.md:199) inside
  Skill Studio scope rather than leaving it stranded

**Negative / trade-offs accepted:**
- Largest single milestone in the 6-milestone roadmap (12-14 phases)
- SEED-007 lift (D-PRD-06) MUST land in v2.6; v3.0 has no fallback if it slips
- v2.6 RAG quality + multi-worker work is squeezed against v3.0 timing
- Risk of mid-milestone scope discovery (5 open questions); resolution
  in /gsd:discuss-phase mitigates but doesn't eliminate

**Architectural implications:**
- Migration starting number 039+ (current head: `038_runs_timed_out_status.sql`
  per STACK.md:13)
- POST-stream → run-backed-streaming pattern for eval SSE events (D-v2.5-08
  inheritance — synthesis §7 RECOVERED_SKILL_STUDIO_PRD update flag)
- New tables: skill_eval_cases, skill_eval_runs, skill_eval_results (rough
  shapes per RECOVERED_SKILL_STUDIO_PRD)
- Implication for v3.0 PRD: must inherit SEED-007 streamsProvider as a hard
  prereq from v2.6
- Implication for v3.4 PRD: Automations can use skills as scheduled-task
  units; eval runs become a special case of scheduled runs

### Alternatives considered + why rejected

- **Trimmed v1 (eval cases + run_skill_eval + Evals panel only); defer
  dual-execution streaming to v3.0.5:** rejected per "ship all, no deferring"
  posture and because dual-execution streaming IS the iterative-dev experience
  that differentiates against OpenAI Assistants
- **Defer Skill Studio to v3.5 (after open platform / multi-tenancy / etc.):**
  rejected — Skill Studio is the headline differentiator and the fastest
  momentum-building public-launch surface; deferring it forfeits the launch
  moment
- **Skill Studio as a separate side-project (not a milestone):** rejected —
  too tightly coupled to existing skills runtime and eval substrate

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 9 + Cluster B (Skill Studio + Agent Execution Modes) + §6 row 3
- Project memory: `project_v3_roadmap_locked.md` (row #9 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: `backend/app/api/skills.py` (existing skills system), Phase 065 (PROJECT.md:138 — skills test infra 26/26 pass), `038_runs_timed_out_status.sql` (current migration head — STACK.md:13)

---

## D-PRD-10 — Pricing: 3-tier flat (Standard / Pro / Enterprise) per-named-user + add-ons

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** Synthesis §9 Open Question 10 ("per-seat / usage-based / org-tier flat / hybrid") — selects flat tier per-named-user with add-ons

### Context

Synthesis §9 Open Question 10 framed four pricing models: per-seat,
usage-based, org-tier flat, and hybrid. Each has a different cost-alignment
shape and a different operational complexity for metering / billing /
enforcement.

For the mid-large enterprise audience (D-PRD-01) and the named reference
competitors (D-PRD-05 — M-Files / Glean / Doxis), the industry pattern is
3-tier flat per-named-user with add-ons. Buyers expect predictable annual
contracts; usage-based pricing creates procurement friction; pure org-tier
flat doesn't scale up cleanly.

Add-ons exist because some scope items (vertical packs per D-PRD-11, advanced
governance for regulated industries, premium support SLAs) only matter for a
subset of customers — bundling them into the base tiers either inflates cost
for everyone or hides value from the customers who'd pay for it.

### Decision

3-tier flat pricing, per-named-user, with add-ons:

- **Standard:** core agent + RAG + skills + basic governance (target: SMB / mid
  / co-tenant SaaS)
- **Pro:** Standard + Skill Studio + automations + advanced RAG (target: mid
  / professional teams)
- **Enterprise:** Pro + multi-tenancy + SSO + audit + dedicated/on-prem
  deployment + SLA (target: large enterprise / dedicated deploy per D-PRD-02)

**Add-ons (orthogonal to tier):**
- Vertical packs (legal, finance, healthcare — per D-PRD-11)
- Advanced governance (regulated-industry compliance pack — DPA, SOC 2 / ISO
  27001 attestations, retention/legal-hold workflow)
- Premium support (named CSM, accelerated response SLA, dedicated Slack)

Specific dollar amounts are NOT decided here (see "Decisions explicitly NOT
made yet" appendix). The MODEL is locked; the prices are calibrated against
buyer signal closer to launch.

### Consequences

**Positive:**
- Predictable annual contracts (enterprise procurement preference)
- Match industry pattern from named reference competitors (buyer expectations
  transfer)
- Add-ons let high-value scope (verticals, governance) ship on a re-trigger
  signal without inflating base tiers

**Negative / trade-offs accepted:**
- Per-named-user creates "shadow user" pressure (orgs trying to share logins);
  must be enforceable via session / device / SSO controls
- Doesn't capture LLM cost variance — heavy users on Standard tier may be
  unprofitable (mitigation: spend caps per tier, see v3.4 PRD)
- Tier feature gating is harder to enforce than usage gating — every
  Pro/Enterprise feature needs a tier-check gate

**Architectural implications:**
- New `subscription_tier` and add-on entitlements concept on the org level
  (depends on D-PRD-02 multi-tenancy in v3.2)
- Feature-flag system or entitlement-check pattern needed across the codebase
  — first user surfaces in v3.0 (Skill Studio = Pro+) and v3.2 (multi-tenancy
  = Enterprise)
- Spend caps / per-org LLM budget enforcement (RECOVERED_Harnessing_Agents
  Opportunity D, SEED-014 spend caps) become operationally required to make
  the flat-tier math work
- Implication for v3.2 PRD: org table needs `tier` + `add_ons` columns from
  day 1
- Implication for v3.0 PRD (Skill Studio): Pro-tier feature gating points
  must be designed in, not retrofitted

### Alternatives considered + why rejected

- **Per-seat with usage overage (hybrid):** rejected — operationally messier;
  most named competitors landed on flat tier
- **Pure usage-based (per-LLM-token / per-run):** rejected — creates
  procurement friction at enterprise; price transparency suffers
- **Flat org-tier (Tier 1 / Tier 2 / Tier 3 with no per-user component):**
  rejected — doesn't scale across user-count flexibility (D-PRD-01)
- **No paid tier (full open-source):** rejected by D-PRD-03 license posture
- **Single tier (one flat price):** rejected — leaves no upsell path and no
  way to differentiate SMB from large enterprise pricing

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 10
- Project memory: `project_v3_roadmap_locked.md` (row #10 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: n/a (business-shape decision; entitlement-check infrastructure lands in v3.2)

---

## D-PRD-11 — Market shape: horizontal core + opt-in vertical packs (legal, finance, healthcare)

**Status:** ACCEPTED 2026-05-10
**Decision-makers:** User (fhdmrd@gmail.com) + research synthesis (commit `d7af056`)
**Supersedes:** SEED-005 §scope framed Tier B (check-in/out, retention, approvals, lifecycle) as core scope; this ADR moves Tier B from core into vertical-pack territory

### Context

Synthesis §9 Open Question 11 framed three market shapes: vertical (legal,
finance, healthcare — heavy DM features per SEED-005 Tier B; compliance per
SEED-004 Phase 7), horizontal (general-purpose; lean on agent + skill
differentiation), or hybrid (horizontal core, opt-in vertical packs).

The hybrid shape is what M-Files and Glean have converged on — horizontal
agent + KB core, with vertical-specific feature packs for the 3-4 industries
that demand them. It maximizes addressable market (horizontal sells anywhere)
while keeping a path to vertical premium (vertical packs are an upsell on top
of Enterprise tier).

### Decision

Horizontal core with opt-in vertical packs. The 6-milestone roadmap (v2.6
through v3.4) ships the horizontal core. v3.5+ vertical packs are
per-vertical milestones, reactive to customer wins (NOT pre-built — the
PRD-reset meta-phase explicitly defers vertical-pack PRDs per
`.planning/prd-reset/PLAN.md` "Scope bounding").

Specifically:
- **Horizontal core (v2.6 - v3.4):** RAG, skills, eval, automations, multi-tenancy,
  open platform, basic DM (Tier A: metadata views, document relationships,
  auto-classification), governance dashboard, audit
- **Vertical packs (v3.5+, reactive):** Legal pack, Finance pack, Healthcare
  pack — each a per-vertical PRD authored when first vertical customer signs
- **SEED-005 Tier B reclassification:** retention, check-in/out, approvals,
  lifecycle — moved from "core scope" to "vertical-pack candidate". Most
  likely lands in legal pack first, but stays open until vertical signal
  arrives

### Consequences

**Positive:**
- Maximizes addressable market in v2.6-v3.4 (horizontal sells anywhere)
- Vertical packs become a real upsell on Enterprise tier (per D-PRD-10
  add-ons)
- Avoids premature vertical-shape commitment — vertical pack #1 PRD reflects
  the actual first vertical customer, not speculation
- SEED-005 Tier A (additive metadata + relationships + auto-classification)
  still ships horizontal-core in v2.6

**Negative / trade-offs accepted:**
- v2.6-v3.4 doesn't ship retention / check-in/out / approvals — large-org DM
  buyers may bounce until first vertical pack lands
- Vertical-pack ordering is undecided (legal first? finance first? wait for
  signal?) — see "Decisions explicitly NOT made yet" appendix
- Vertical-pack add-on pricing (D-PRD-10) hasn't been calibrated; specific
  numbers wait until vertical-pack PRD is authored

**Architectural implications:**
- v3.4 DM Tier B (synthesis §5 Option A v3.4) is REDUCED in scope — drops the
  "DM Tier B as core" framing; v3.4 keeps Automations as primary scope and
  treats DM lifecycle features as a future-vertical-pack extraction point
- The codebase must support pluggable vertical packs by v3.5 — likely a
  module-loader or feature-flag-driven shape; design unblock candidate for
  v3.4 PRD
- Implication for v3.4 PRD: must explicitly carve out which DM lifecycle
  features stay core (e.g. retention as a generic governance feature) vs
  vertical-pack (legal-specific check-in/out workflows)
- Implication for v3.2 PRD (multi-tenancy): org schema must support per-org
  add-on entitlements — Phase 0 of vertical-pack readiness

### Alternatives considered + why rejected

- **Pure horizontal (no vertical packs ever):** rejected — caps the
  enterprise upsell motion; named competitors (M-Files particularly) win
  vertical deals on vertical features alone
- **Pure vertical (pick one, e.g. legal, and own it):** rejected — forfeits
  the broad mid-large enterprise market the agent + skill story addresses
- **Vertical packs in core (build legal + finance + healthcare features into
  v2.6-v3.4):** rejected — premature; no first-vertical-customer signal yet;
  bloats the horizontal core with features 80% of customers won't use
- **Vertical packs as third-party plugins only (don't ship our own):**
  rejected — first vertical customer needs proof we'll ship the pack, not
  hope a partner does

### Sources

- Synthesis section: `.planning/research/milestone-shaping-2026-05-09.md` §9 Open Question 11 + Cluster E (Multi-Tenancy & Org Model — partial intersection with SEED-005 Tier B) + §2 SEED-005 row
- Project memory: `project_v3_roadmap_locked.md` (row #11 of locked decisions table)
- Prior commit anchor: `d7af056`
- Code references: n/a (business-shape decision; vertical-pack infrastructure lands no earlier than v3.4-v3.5)

---

## D-PRD-13 — Skill Versioning: semver + immutable-on-publish

**Status:** ACCEPTED 2026-05-12 (locked by Plan 09 cross-PRD consistency pass)
**Decision-makers:** User signoff post-Plan 09 + research subagent (Plan 09 SUMMARY.md §A.1)
**Supersedes:** Q-v3.0-05 (lifted from milestone-internal to cross-milestone after v3.3 ZIP roundtrip and v3.4 routine pinning both surfaced dependencies on a single versioning shape)

### Context

The skills system shipped in v2.0 (RECOVERED_Episode4_PRD) has no concept of versions — a skill's instructions can be edited in place. v3.0 Skill Studio's iterative dev loop needs a way to compare ratings across versions so users can see whether their changes improved the skill. v3.3 Open Platform's ZIP roundtrip needs a stable per-version reference for export/import. v3.4 Automations needs to pin a routine to a specific version so in-flight runs aren't disrupted by edits.

If each PRD picked its own versioning shape, the three milestones would produce three incompatible representations of "skill version" — an architectural collision Plan 09 caught before it shipped.

### Decision

Skills carry semver text versions on a new `skill_versions` table; published versions are IMMUTABLE; editing a published version creates a new draft row; explicit publish flips `published_at = now()`. Backfill: existing skills get synthetic `1.0.0`. Eval runs (v3.0) and routine runs (v3.4) link to `skill_version_id`. ZIP export (v3.3) writes per-version siblings under `versions/<semver>.md` in the bundle.

### Consequences

**Positive:**
- v3.0 ships primary infrastructure (Theme E migrations 054-055) — once
- v3.3 ZIP export gets a clean per-version surface — no extra schema work
- v3.4 routine_definitions can pin to `skill_version_id` so in-flight runs survive author edits
- Future skill marketplace (deferred to v3.5+) has a portable version-aware artifact

**Negative / trade-offs accepted:**
- Skill authors now have to think about publishing (vs the previous "edit in place" mental model). Mitigated by drafts being mutable.
- Backfill migration must touch every existing skill row.

**Architectural implications:**
- `skills.current_version_id` FK column added (v3.0)
- Migration ordering: v3.0 ships skill_versions; v3.3 builds export on top; v3.4 references at routine publish

### Alternatives considered + why rejected

- **Per-milestone versioning (let each PRD pick)** — rejected: three incompatible representations would collide; Plan 09 already caught this in PRD authoring
- **Integer-only versions** — rejected: loses ability to communicate major/minor/patch intent; semver is the industry-standard skill-author mental model
- **Mutable published versions with audit log** — rejected: breaks v3.4 routine pinning semantics (you can't pin to "version X" if X can be mutated)

### Sources

- `.planning/PRDs/v3.0.md` §3 Theme E + Q-v3.0-05
- `.planning/PRDs/v3.3.md` §3 Theme A
- `.planning/PRDs/v3.4.md` §3 Theme B + Q-v3.4-07
- `.planning/prd-reset/SUMMARY.md` §A.1
- Prior commit anchor: `29be513`

---

## D-PRD-14 — Operator Role Tier: SYSTEM-level vs ORG-level split

**Status:** ACCEPTED 2026-05-12 (locked by Plan 09 cross-PRD consistency pass)
**Decision-makers:** User signoff post-Plan 09 + research subagent (Plan 09 SUMMARY.md §A.1)
**Supersedes:** Q-v3.1-06 (lifted from milestone-internal because v3.2 multi-tenancy, v3.3 service accounts, and v3.4 routine ownership all inherit the SYSTEM-vs-ORG boundary)

### Context

v3.1 ships an admin shell with a new role tier above ordinary users (operator / super-admin). v3.2 multi-tenancy adds an org-level role hierarchy (org_admin / dept_admin / member). v3.3 service accounts inherit org membership. v3.4 routines are org-scoped with owner/editor roles. Without a locked boundary between SYSTEM-level (cross-org) and ORG-level (intra-org) roles, the four milestones would each invent their own permission rules — a maintenance bomb at v3.4 close.

### Decision

Two-axis role hierarchy with a strict boundary:
- **SYSTEM-level (cross-org):** `super_admin`, `operator` → `operator_users` table (v3.1)
  - super_admin: full control over the whole deployment; can create orgs, impersonate any user, manage operators, edit MODEL_CAPABILITIES, run migrations
  - operator: cross-org read/cancel/restart; can NOT create orgs or impersonate
- **ORG-level (intra-org):** `org_admin`, `dept_admin`, `member` → `org_members.role_id` + `dept_members.role_id` (v3.2)
  - org_admin: full control within their org
  - dept_admin: full control within their department
  - member: standard user permissions

A user can hold roles on BOTH axes — e.g., a super_admin user is also implicitly an org_admin of any org they belong to (operators cannot edit user content; that's the boundary).

### Consequences

**Positive:**
- v3.1 ships SYSTEM-level cleanly (operator_users + BOOTSTRAP_SUPER_ADMIN_EMAIL env var)
- v3.2 ships ORG-level (4-tier with role_permissions table) layered on top, not retrofit
- v3.3 service accounts inherit org_id from v3.2 membership AND respect SYSTEM-level operators for cross-org observability
- v3.4 routine ownership maps cleanly to org-tier roles

**Negative / trade-offs accepted:**
- More permission rules to author and test than a flat model
- Users moving between orgs need careful row-cleanup (mitigated by membership tables, not role columns on auth.users)

**Architectural implications:**
- `operator_users` table is SEPARATE from `org_members` — they are independent axes
- RLS policies must check both axes for cross-org admin actions (super_admin can read all orgs; operator can read but not write)
- Q-v3.2-03 (4-tier role hierarchy) folds into this ADR — same decision

### Alternatives considered + why rejected

- **Single flat role list** — rejected: SaaS operator (whose job is keeping the deployment healthy) is conceptually different from an org admin (whose job is managing their org's content); merging them produces leaky abstractions
- **Org-only (no SYSTEM tier)** — rejected: in hybrid SaaS, there must be a role tier ABOVE any org (otherwise no one can manage the deployment in co-tenant mode)
- **Three flat tiers (admin / mod / user)** — rejected: loses the cross-org vs intra-org distinction critical for hybrid SaaS

### Sources

- `.planning/PRDs/v3.1.md` §3 Theme A + Q-v3.1-06
- `.planning/PRDs/v3.2.md` §3 Theme A + Q-v3.2-03
- `.planning/PRDs/v3.3.md` §3 Theme B
- `.planning/PRDs/v3.4.md` §3 Theme G
- `.planning/prd-reset/SUMMARY.md` §A.1
- Prior commit anchor: `29be513`

---

## D-PRD-15 — SecretsBackend Interface Contract

**Status:** ACCEPTED 2026-05-12 (locked by Plan 09 cross-PRD consistency pass)
**Decision-makers:** User signoff post-Plan 09 + research subagent (Plan 09 SUMMARY.md §A.1)
**Supersedes:** Q-v3.1-07 (lifted from milestone-internal because v3.2 SSO `idp_metadata`, v3.3 webhook HMAC keys, and v3.1.5+ BYOK encryption all read/write through the same interface)

### Context

v3.1 introduces a secrets management surface to close `CONCERNS.md:81-83` (API keys stored as plain text on disk). v3.2 SSO needs to store `idp_metadata` securely. v3.3 webhooks need HMAC signing keys. Enterprise tier (v3.1.5+) needs customer-managed keys (BYOK) via KMS adapters.

If each subsystem reaches into its own secrets storage, the security surface fragments and "where is this secret stored?" becomes unanswerable. Locking the interface at v3.1 ship lets every downstream subsystem use the same contract without app-code changes when adapters land.

### Decision

The `SecretsBackend` Python interface stabilizes at v3.1 ship:

```python
class SecretsBackend(Protocol):
    async def get(self, key: str) -> bytes | None: ...
    async def set(self, key: str, value: bytes) -> None: ...
    async def rotate(self, key: str) -> RotationToken: ...
    async def list_keys(self) -> list[KeyMetadata]: ...
```

v3.1 ships two implementations:
- `EncryptedPostgresSecretsBackend` — default; secrets in a `secrets` table encrypted with `pgsodium`; key rotation via dual-write window
- `EnvVarReadOnlySecretsBackend` — legacy compatibility; NEVER writes back to env vars

Adapters (Vault, Doppler, 1Password Connect, Infisical, AWS KMS / Azure Key Vault / GCP KMS) ship in v3.1.5+ as enterprise-tier add-ons (per D-PRD-10). No app-code changes elsewhere.

### Consequences

**Positive:**
- v3.1 ships the interface + 2 default implementations — closes the plain-text-on-disk finding immediately
- v3.1.5+ adapters are config-only swaps; no code touch outside `backend/app/secrets/`
- v3.2 SSO `idp_metadata` + v3.3 webhook secret HMAC keys read/write through one path — auditable single surface
- BYOK encryption becomes a clean v3.1.5+ extension via `KmsBackedSecretsBackend` adapter

**Negative / trade-offs accepted:**
- Async-only interface forces every call site to be inside an async context (already true for most v3.x code, but blocks any future sync use case)
- `pgsodium` adds a Postgres extension dependency for fresh installs

**Architectural implications:**
- `backend/app/secrets/` module owns the interface + implementations
- Selection via env var `SECRETS_BACKEND=postgres|env|vault|...`
- v3.1 admin UI for secrets rotation reads from `list_keys()`; never displays values; rotation goes through `rotate()`

### Alternatives considered + why rejected

- **Direct vault SDK use everywhere** — rejected: locks every install to one secrets provider; breaks self-host shape diversity (Solo / Team / Enterprise)
- **Synchronous interface** — rejected: v3.x request paths are async; sync would force `run_in_threadpool` everywhere
- **Sync interface with async wrapper** — rejected: extra indirection with no benefit; cleaner to require async at the bottom

### Sources

- `.planning/PRDs/v3.1.md` §3 Theme J + Q-v3.1-07
- `.planning/prd-reset/SUMMARY.md` §A.1 + §C.2 surfaced feature #3 (BYOK)
- Prior commit anchor: `29be513`

---

## Decisions explicitly NOT made yet (open for future PRD authoring)

This appendix lists decisions that are deliberately left open so that PRD
authoring (Plans 03-08) and downstream `/gsd:discuss-phase` runs can resolve
them in their proper context. New decisions surfaced here SHOULD be added to
this DECISIONS.md as additional ADRs (D-PRD-12, D-PRD-13, ...) once locked,
not re-litigated by overwriting existing rows.

**Pricing & customer commercial:**
- Specific Standard / Pro / Enterprise dollar amounts (per-named-user/month) —
  calibrated against buyer signal closer to launch
- Specific add-on pricing per add-on (vertical packs, advanced governance,
  premium support) — calibrated against vertical-pack PRD authoring
- Annual vs monthly contract default and discount %
- Free trial / freemium policy (does Standard tier have a free version?)
- Exact target customer count or revenue target for v2.6 close — KPI for
  milestone signoff TBD

**Vertical pack timing & ordering:**
- Vertical-pack ordering after v3.4 (legal first? finance first? healthcare
  first? wait for first vertical customer signal?) — answered when first
  vertical customer signs
- SEED-005 Tier B reclassification: which Tier B features stay in horizontal
  core (e.g. generic retention) vs move into legal pack (e.g. legal-specific
  approval workflows) — resolved in v3.4 PRD authoring

**v2.6 architecture decisions (resolved in v2.6 PRD / discuss-phase):**
- Docling httpx<0.28 vs supabase 2.10 conflict resolution path
  (upgrade supabase past httpx pin / pin httpx<0.28 if compatible /
  subprocess isolation for Docling)
- Multi-worker rollout strategy (asyncpg first → workers second sequentially,
  or atomic single-phase swap)
- Confidence threshold recalibration after Docling extractor swap (re-run
  Phase 32.5 calibration or reuse current calibration)

**v3.0 Skill Studio open questions (5 — resolved in v3.0 PRD / discuss-phase):**
- Sequential vs parallel eval execution
- Target-skill-only vs full catalog inject during eval (collides with
  SKILL-01/02 tech debt — PROJECT.md:199)
- Text vs file output for eval results
- UI-driven test case creation in v1
- Skill versioning column / strategy

**v3.1 Operator UX open questions (resolved in v3.1 PRD):**
- Operator role permission model — single super-admin vs RBAC tier above
  existing user roles
- Secrets store choice — env vars / HashiCorp Vault / Doppler / 1Password
  Connect / Supabase Vault
- Deployment presets — what tiers (Solo / Team / Enterprise / co-tenant /
  on-prem) and what each preset configures
- On-prem packaging shape — single Docker compose / k8s helm chart / both
- RECOVERED_VPS_Deployment_Guide.md `--workers 2` correction baked in once
  D-PRD-08 lands

**v3.2 Multi-tenancy open questions (resolved in v3.2 PRD):**
- Multi-tenancy isolation model — single Supabase + org_id discriminator + RLS
  / Supabase project per org / hybrid (free/standard tier shared, enterprise
  dedicated)
- SSO scope — SAML / OIDC / both
- Org admin role hierarchy — super-admin / org-admin / dept-admin / member
- Migration path from existing single-tenant data (per-user → per-org
  assignment)
- `match_document_chunks` SECURITY DEFINER RPC tenancy audit (CONCERNS.md:69-76)

**v3.3 Open Platform open questions (resolved in v3.3 PRD):**
- Service-account auth model — per-org bearer token / scoped JWTs /
  OAuth2 client credentials
- MCP transport — stdio (desktop) / HTTP (cloud) / both
- Rate limiting tier — per-key / per-org / per-endpoint, token bucket on Redis
- CORS policy — currently `allow_origin_regex=r"http://localhost:\d+"`
  (CONCERNS.md:543); needs explicit allow-list per consumer
- SDK languages — Python + TypeScript v1; others later
- API versioning strategy — `/api/v1/` URL prefix / Accept header / both
- Webhook delivery semantics — at-least-once + signed HMAC; retry policy

**v3.4 Automations open questions (resolved in v3.4 PRD):**
- Scheduler choice — APScheduler / Celery beat / arq / custom on Redis
- Event bus — Redis Streams `events:*` namespace / Postgres NOTIFY/LISTEN /
  external (Kafka)
- Long-running run checkpointing (RECOVERED_Harnessing_Agents Opportunity E
  — Agent Checkpointing) — fold into v3.4 or split out
- Spend caps — per-org / per-routine / per-run; enforcement layer
- DM Tier B retention model (if any stays core after D-PRD-11) — per-doc /
  per-folder / per-org policy
- Approval workflow shape (if any stays core after D-PRD-11) — linear /
  parallel / conditional

---

## Cross-references

- Synthesis (full): `.planning/research/milestone-shaping-2026-05-09.md`
- Project memory (locked roadmap + decisions): `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_v3_roadmap_locked.md`
- PRD-reset phase plan: `.planning/prd-reset/PLAN.md`
- PRD template (Plan 02 output, downstream of this file): `.planning/prd-reset/PRD-TEMPLATE.md`
- 6 milestone PRDs (Plans 03-08 outputs): `.planning/PRDs/v2.6.md`, `.planning/PRDs/v3.0.md`, `.planning/PRDs/v3.1.md`, `.planning/PRDs/v3.2.md`, `.planning/PRDs/v3.3.md`, `.planning/PRDs/v3.4.md`
- Cross-PRD consistency report (Plan 09 output): `.planning/prd-reset/SUMMARY.md`
- Project state: `.planning/PROJECT.md` (Key Decisions table — the per-milestone D-vN.N-NN ADRs live there; this file is for cross-milestone D-PRD-NN ADRs)
- Project memory cross-refs cited inline above:
  - `project_target_scale.md` (D-PRD-01)
  - `project_org_level_deferred.md` (D-PRD-02)
  - `project_seed006_multimodal_quality.md` (D-PRD-07)
  - `project_phase32_5_chunking_fixes.md` (D-PRD-07)
