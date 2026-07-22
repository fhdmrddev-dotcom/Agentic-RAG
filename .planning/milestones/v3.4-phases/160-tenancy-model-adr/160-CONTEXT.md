# Phase 160: Tenancy-Model ADR - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a written **Tenancy-Model ADR** that *ratifies* the tenancy posture for the entire v3.4 milestone. **No code, no schema, no threat model, no research-phase.** The single deliverable is a decision document — the settled, non-relitigated foundation every downstream phase (161–168) builds on.

**Requirement:** ADR-01 (Governance).

**In scope:**
- A written ADR ratifying **D-PRD-02** (co-tenant `org_id` + membership RLS by default; isolation-via-deployment for enterprise).
- Locking the naming/renumbering decisions as **binding** for phases 161–168: `skills.is_system` → `is_system_global` reuse, `is_global` → `is_org_shared` rename, and v3.4 migrations continuing at **slot 104+**.
- Recording that v3.3's shipped `org_id` stubs + Solo/Team/Enterprise deploy presets already **~80% pre-decided** this posture (ratify-not-relitigate).
- Ratifying the **4-tier deployment-flexibility contract** (SC#4) — the one genuinely-new, binding-and-non-negotiable commitment (see D-01 below).

**Out of scope (explicitly — this phase writes a document):**
- Any code, migration, or schema change (those start in Phase 161).
- Re-litigating the posture — D-PRD-02 was ACCEPTED 2026-05-10 and is confirmed unchanged (see D-04).
- Threat modeling (no code → no attack surface this phase).

</domain>

<decisions>
## Implementation Decisions

### Deployment-Flexibility Contract (SC#4 — the one binding new commitment)
- **D-01:** The ADR makes the deployment-flexibility contract a **hard contract with per-phase enforcement** (not milestone-close-only). It binds BOTH halves:
  1. **All 4 tiers stay a pure env-var switch** — **solo-local**, **small-team-VPS**, **medium-SaaS (co-tenant)**, **enterprise / on-prem / BYO (isolation-via-deployment, customer-owned Supabase)** — with **no hardcoded URLs / keys / models / ports**; the **local setup never breaks**; and the co-tenant-vs-isolated choice is a **deploy-time decision, never a code fork**.
  2. **Forward-compatibility substrate ([[SEED-120]]):** the org-settings + encrypted-secrets substrate must stay forward-compatible with **per-org provider config**, **bring-your-own API keys**, and **per-org (including local) model selection** — so v3.5 adds those with **NO schema rewrite** (reusing the v3.3 SEC-01 `enc:v1:` MultiFernet envelope + the DB>env `_val` precedence chain; org-scoped settings as an `app_settings` analog).
  - **Enforcement clause (binding):** every subsequent v3.4 phase (161–173) is **verified against this contract** — nothing a phase ships may make any deployment tier harder. This is a per-phase verification obligation, echoed into each phase's success criteria/verification, not just a one-time milestone-exit check.

### ADR Home & Shape
- **D-02:** The ADR lives in **two places (both)**:
  1. A **standalone ADR document in the phase folder** — `.planning/phases/160-tenancy-model-adr/160-ADR.md` (the full ratification; the phase's deliverable; the **stable canonical path phases 161–168 cite**).
  2. A **short `D-v3.4-01` pointer entry appended to `.planning/prd-reset/DECISIONS.md`** — references the standalone ADR and the already-accepted `D-PRD-02`, so the central decision register stays complete on the milestone's biggest posture call without duplicating the whole document.
  - **Naming/renumbering locks** (carried, recorded as binding in the ADR): `skills.is_system` → `is_system_global`; `is_global` → `is_org_shared` (value-preserving RENAME, never drop+add); migrations continue at **slot 104+**. These are stated as binding-for-161–168, not re-opened.
  - Follow the existing register convention: `D-PRD-NN` = business-shape decisions; `D-vX.Y-NN` = per-milestone architectural decisions → this new entry is **`D-v3.4-01`**.

### One-Way-Door / Reversal Framing
- **D-03:** The ADR **includes a short "Consequences + reversal" section**:
  - **One-way-door cost:** co-tenant → isolated is a **redeploy on a customer-owned Supabase (a deploy-time switch, not a code fork)**; the expensive / unlikely direction is isolated → co-tenant (re-tenanting separate deployments back into a shared one).
  - **Named escape valve:** a **paying customer forcing isolation / integrations-first** is the concrete trigger that would re-order priorities (consistent with the post-v3.4 sequencing note in `PRDs/SEQUENCE.md`).
  - Keep it short — a Consequences/reversal paragraph, not a re-argument of the decision.

### Posture Confirmation
- **D-04:** **Clean ratify — no changes.** Co-tenant (`org_id` + membership RLS) as the default + isolation-via-deployment (customer-owned Supabase) for enterprise is confirmed as-is. The ADR ratifies D-PRD-02 unchanged; ~80% was already shipped in v3.3 (org_id stubs on the 4 owned roots + org-agnostic `operator_users` + Solo/Team/Enterprise presets).

### Claude's Discretion
- Exact ADR document structure/headings, prose, and the precise wording of the `D-v3.4-01` register entry are the planner/executor's discretion — as long as SC#1–4 are each observably satisfied and D-01…D-04 above are honored.
- The exact standalone-ADR filename may refine to the executor's naming (e.g. `160-ADR.md` vs `160-01-ADR.md`), but it MUST be a stable phase-folder path that 161–168 can cite.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The decision being ratified (primary)
- `.planning/prd-reset/DECISIONS.md` — **D-PRD-02** (Hybrid SaaS posture: co-tenant SMB/mid + dedicated/on-prem large enterprise — the posture this ADR ratifies) and **D-14** (red line: Deep Mode byte-identical, provider differences at the gateway/adapter boundary, no new runtime). The new **`D-v3.4-01`** pointer entry is appended here (D-02). Note the ADR-ID convention header (`D-PRD-NN` vs `D-vX.Y-NN`).
- `.planning/REQUIREMENTS.md` — **ADR-01** (this phase's requirement) + full 29-requirement v3.4 context + the Out-of-Scope table.
- `.planning/ROADMAP.md` — **Phase 160 detail** (SC#1–4, verbatim), the v3.4 milestone overview, and the **"Guardrails, gates & sequencing (v3.4)"** block (atomic-crux lock, data-dependency order, red line, reported-bugs rule, cloud-parity owed).

### The forward-compat obligation (SC#4)
- `.planning/seeds/SEED-120-*.md` — per-org provider config + BYO API keys + per-org (incl. local) model selection; the forward-compat guarantee SC#4/D-01 must keep the substrate ready for (delivered in v3.5, must need no schema rewrite). Related: `[[SEED-121]]` (key pooling/rotation), `[[SEED-122]]` (local-model validation), `[[SEED-117]]` (v3.5 config-consolidation).
- `docs/DEPLOYMENT-WORKFLOW.md` — the local↔cloud parity rules + "pure env-var switch" contract the tier-flexibility guarantee (D-01) is grounded in.
- `deploy/onebox.env.example` + `docs/OPERATOR.md` — the shipped Solo/Team/Enterprise deploy presets (Phase 157) that make the co-tenant-vs-isolated choice deploy-time-only today.

### Research base (re-authored against live schema head 103 — context, not required to re-derive)
- `.planning/research/SUMMARY.md` — the re-authored v3.4 research synthesis (38 user-facing tables, 4 SECDEF retrieval/sharing functions, Supabase-native SAML). Highest-signal for phases 161+.
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md` — supporting re-authored research (2026-07-18 pass).
- `.planning/PROJECT.md` → **Current Milestone: v3.4 Multi-Tenancy & Org Access** — milestone framing + the "one-way door is largely pre-decided" note.

</canonical_refs>

<code_context>
## Existing Code Insights

**This is a documentation phase — no code is written.** The relevant "prior art" is the v3.3-shipped substrate the ADR *ratifies* and the forward-compat obligation depends on:

### Reusable Assets (the ~80% already shipped — the ADR records, does not build)
- **`org_id` stubs** (migrations 095/096, live) — nullable `org_id` on the 4 owned roots + org-agnostic `operator_users`. The additive foundation Phase 161 extends.
- **Solo/Team/Enterprise deploy presets** (Phase 157 — `deploy/onebox.env.example`, `docker-compose.prod.yml`, `OPERATOR.md`) — make co-tenant-vs-isolated a deploy-time env choice **today**; the concrete proof behind D-01's tier-flexibility guarantee.
- **Encrypted-secrets substrate** (Phase 150, SEC-01) — app-layer MultiFernet `enc:v1:` envelope + the DB>env `_val` precedence chain. SEED-120 (D-01 half 2) reuses this — **no new crypto** — which is why the forward-compat guarantee is credible.

### Established Patterns (constrain the ADR's framing)
- **Two-layer governance pattern** (SEED-116 / VIS-01 / VIS-02) — operator governs the platform-allowed set → org-admin narrows → user picks within → lock flags. D-01's per-org-provider forward-compat is this pattern applied to providers/keys.
- **Red line D-14** — Deep Mode byte-identical; provider differences at the gateway/adapter boundary; no new runtime. The ADR's deployment-flexibility contract must not imply any shared-path fork.

### Integration Points
- None this phase (no code). The ADR's job is to make phases 161–168's integration points *decided in advance*.

</code_context>

<specifics>
## Specific Ideas

- The deployment-flexibility contract must explicitly enumerate the **4 named tiers** (solo-local / small-team-VPS / medium-SaaS co-tenant / enterprise-BYO customer-owned-Supabase) — not a generic "flexible deployment" statement.
- The forward-compat guarantee must name the **three concrete SEED-120 capabilities** (per-org provider config, BYO keys, per-org incl. local model selection) and the **"no schema rewrite in v3.5"** bar — so a future planner can check compliance objectively.
- "Ratify-not-relitigate" is a real constraint: the ADR frames the posture as **settled** (a reader sees it is not re-opened), citing D-PRD-02's prior acceptance and the v3.3 ~80%-shipped evidence — not as a fresh debate.

</specifics>

<deferred>
## Deferred Ideas

- **None from this discussion** — the conversation stayed within phase scope (an ADR ratification). SC#4's forward-compat obligation is IN scope (it's the binding contract), but the *delivery* of per-org provider config / BYO keys / local-model-per-org is [[SEED-120]] → **v3.5**, deliberately not built here.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (todo.match-phase score 0.6) — **reviewed, NOT folded.** A keyword false-positive (matched on generic "phases / milestone / first / schema"). It concerns NL→visual/no-code workflow authoring ([[SEED-123]] — the deferred post-v3.4 UX/no-code-builder track), which has no relationship to the Tenancy-Model ADR. Belongs to a later milestone, not v3.4.

### Reported-bugs cross-check (MANDATORY touchpoint — result)
- **No open `surface: Agentic-RAG` reported-bug folds into Phase 160.** Every open report is chat/streaming/provider-surface (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04, cancelled-run/killed-workflow cluster, etc.) with no overlap on a no-code ADR's domain. Per the ROADMAP guardrail + CLAUDE.md filter rule, the chat-surface backlog is explicitly kept OUT of v3.4 (its own planned post-v3.3 chat-polish phase); only **SEED-091** folds into v3.4 — and that lands in **Phase 164** (TEN-06), not here.

</deferred>

---

*Phase: 160-tenancy-model-adr*
*Context gathered: 2026-07-18*
