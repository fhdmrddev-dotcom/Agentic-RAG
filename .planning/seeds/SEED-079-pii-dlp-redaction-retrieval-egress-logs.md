---
seed_id: SEED-079
title: PII detection / redaction (DLP) across retrieval, prompts, provider egress, and logs — no data-loss-prevention gate before regulated data leaves the boundary
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: security / compliance / data-governance — a data-loss-prevention (DLP) gate at the ingestion, retrieval-context, provider-egress, and log-capture boundaries; a cross-cutting policy seam, NOT a single feature
related_seeds: [SEED-072, SEED-075, SEED-061, SEED-005, SEED-004, SEED-048, SEED-001]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, project_seed006_multimodal_quality, feedback_provider_uniform_ux, feedback_separate_per_feature_safe_by_construction]
trigger_when:
  - A milestone scoped to multi-tenancy / org-level (SEED-004) or the lighter hosted co-tenant SaaS subscription is planned — the company becomes the data processor and regulated PII flows to third-party providers on shared keys with no gate
  - SEED-005 Enhanced Document Structure (the operator-confirmed NEXT milestone) reaches spec — the ingestion-time PII-detection hook folds naturally into its "custom metadata + per-field confidence" extractor, far cheaper than a separate pass
  - A B2B customer in a regulated vertical (legal / finance / healthcare — the v3.5+ vertical-pack roadmap) raises PII handling, a "no-PII-to-external-LLM" requirement, or a HIPAA/GDPR data-flow question in procurement security review
  - v3.3 Open Platform exposes retrieval/agent calls programmatically — API consumers ship arbitrary regulated context through the same un-gated egress path at higher volume
  - LangSmith tracing is turned on for a SHARED or production deployment (it is on by default — `langsmith_tracing="true"`, config.py:932) — full prompts including retrieved PII land in a third-party trace store
  - The compliance cluster (SEED-072 data-subject rights, SEED-075 backup/DR) is scoped — DLP belongs in the same Enterprise/Compliance Readiness body of work
priority: high — a genuinely-homeless governance gap with no detection/redaction layer anywhere in the codebase; the single riskiest uncaptured egress surface because LangSmith is on by default and prompts carry full retrieved context. Not load-bearing for single-operator dev, but a primary procurement-security blocker the moment a regulated customer or the co-tenant SaaS tier exists.
suggested_phase: a future Enterprise / Compliance Readiness body of work (co-design with SEED-072 + SEED-075 alongside the v3.2 RLS rewrite, since the per-org policy hook is org-scoped); the ingestion-detection half folds into SEED-005. NOT v2.9.
---

# SEED-079 — PII detection / redaction (DLP) across retrieval, prompts, provider egress, and logs

## The gap

There is **no PII-handling layer anywhere** in the platform — not at ingestion, not
before retrieved context ships to an LLM, not before prompts are written to logs. A
grep of `backend/app` for any detection/redaction/masking primitive returns nothing.
The alignment-sweep hunt confirmed every boundary where regulated data leaves the
trust boundary is wide open:

| Boundary | Current behavior | Seam |
|---|---|---|
| **Ingestion** | Documents ingest **verbatim** — extracted text is chunked and embedded with no detection, no redaction, no per-field PII confidence | `documents.py:146` `_upload_pipeline` (scheduled at :491) |
| **Retrieval → prompt** | `match_document_chunks` returns raw chunk text that becomes LLM context; no masking pass sits between the chunk row and the prompt | `match_document_chunks` (migration 034 `034_dynamic_vector_match.sql`) |
| **Provider egress** | The full prompt — system prompt, history, **and retrieved chunk context** — ships to whatever third-party provider routing picks (OpenAI / Anthropic / Google / native-7 / OpenRouter) with **no DLP gate, no per-org provider-allowlist for sensitive data** | the provider service boundary (`anthropic_service.py`, `openai_service.py`, etc.) |
| **Log / trace capture** | LangSmith tracing is **ON by default** (`langsmith_tracing="true"`, config.py:932; configured at `main.py:76-80`) and the LLM calls are `@traceable`-wrapped to capture **inputs** — so full prompts, **including any PII carried in retrieved context**, land in a third-party trace store | `anthropic_service.py:151` (`@_ls_traceable(run_type="llm")`), `openai_service.py:880` (auto-trace inputs/system prompt/tools/outputs) |

The closest existing coverage is SEED-061 (context-engineering lift), which mentions
**poisoning / clash defenses but not PII** — so even the one adjacent seed leaves this
hole open. No requirement, phase, or PRD owns it.

## Why it matters at the product's target scale

The product must **serve any scale from one codebase**, is **B2B-first** with a possible
**lighter hosted multi-tenant SaaS subscription**, and leaves **infrastructure to the
buying company against published requirements** (the single-VPS Phase 080 plan was
operator self-testing only, never the target). Against that posture, an un-gated PII
egress surface is the **riskiest single uncaptured governance hole**:

- **The hybrid co-tenant posture sharpens it.** In the hosted-SaaS tier the company
  becomes the **data processor**: a customer's regulated PII flows to whatever provider
  routing picks, on **shared provider keys**, with no per-org "no-PII-to-external-provider"
  policy and no redaction. That is a direct HIPAA/GDPR exposure the company itself owns.
- **LangSmith makes it worse silently.** Tracing is on by default, so even before a
  single deliberate egress decision, full prompts with retrieved PII are persisted to a
  third-party observability store. An operator who never touched a setting is already
  leaking.
- **The regulated verticals are on the roadmap.** Legal / finance / healthcare vertical
  packs (v3.5+) cannot be sold without a DLP story — "where does my PII go, and can you
  prove it doesn't reach an external LLM?" is a primary procurement-security objection.
- **It rides the same org-scoped surface as the v3.2 RLS rewrite.** A per-org DLP policy
  is org-scoped by definition; designing it alongside the multi-tenancy rewrite (the
  same 18-table surface SEED-072 and the compliance cluster touch) is an order of
  magnitude cheaper than retrofitting after isolation lands.

Affected milestones (from the sweep): **v3.2 Multi-Tenancy**, **SEED-005 Enhanced
Document Structure** (the next milestone — the detection hook folds into its per-field
confidence extractor), **v3.3 Open Platform**, and the **v3.5+ vertical packs**.

## Why it is deferred / not now

- **No single-operator / small-team pain today.** A solo or trusted-team install with
  the operator's own provider keys has no regulated-PII exposure that a DLP gate would
  change — the gap only becomes load-bearing once a *regulated customer* or the
  *co-tenant SaaS tier* exists. Building it before then is premature.
- **It belongs with the compliance cluster, not v2.9.** v2.9 is Workflow Studio; the
  DLP gate co-designs with SEED-072 (data-subject rights) and SEED-075 (backup/DR) as
  one Enterprise/Compliance Readiness body of work near the v3.2 RLS rewrite — not as a
  scattered point fix.
- **The cheapest detection cut depends on SEED-005.** The ingestion-time detection half
  wants to ride SEED-005's "custom metadata + per-field confidence" extractor rather
  than add a second full extraction pass; doing it standalone now would duplicate work
  SEED-005 will build anyway.
- **Provider-uniform-UX discipline.** The redaction/policy logic must live at the
  service boundary per the one-UX-N-adapters principle; rushing it would risk breaking
  the shared egress path across the native-7 providers.

## Likely shape if promoted

Co-plan with SEED-072 + SEED-075 (compliance cluster) and the v3.2 RLS rewrite; fold
the detection half into SEED-005. Candidate scope, ordered:

1. **Ingestion-time PII detection (folds into SEED-005).** An optional detector
   (Presidio-style NER + regex recognizers, or a provider-judge pass) at
   `documents.py:146` `_upload_pipeline` that tags chunks/fields with detected entity
   types + **per-field confidence** — reusing SEED-005's confidence-metadata column
   rather than a new extraction pass. Detection only; no destructive rewrite of the
   stored chunk.
2. **Redaction / masking before the two egress boundaries.** A masking pass between
   the retrieved chunk and (a) the prompt that ships to the provider, and (b) the
   `@traceable` input captured by LangSmith — so PII is masked **before** it crosses
   either boundary, not after. Reversible-token vs hard-mask is a policy choice. This
   sits at the provider service boundary (one shared seam, applied uniformly across the
   native-7) and at the LangSmith config seam (`main.py:76-80` / the `@traceable`
   wrappers).
3. **Per-org policy hook on the provider-routing seam.** A per-org
   `no-PII-to-external-provider` / allowlist policy (e.g. "sensitive corpora may only
   route to an approved provider, or must be redacted before egress") wired to the
   provider-routing decision — org-scoped, so it co-designs with the v3.2 RLS rewrite.
4. **Redaction-in-logs as the default-safe posture.** Given LangSmith is on by default,
   ship the log/trace redaction as the **first** deliverable — it closes the silent leak
   even before the policy surface exists.
5. **Published DLP-requirements row.** What detection/redaction guarantees the platform
   provides per deployment shape, what the buyer configures (provider allowlist,
   LangSmith on/off, on-prem detector model) — the "clear requirements for the buying
   company" deliverable, landing alongside SEED-075's per-tier published requirements.

## Deliberately NOT in scope (when it lands)

- A bespoke ML PII classifier — start with an off-the-shelf detector (Presidio /
  regex / a provider-judge pass) before building anything custom.
- Destructive ingestion rewrite — detection tags; redaction happens at the egress
  boundary so the stored chunk and the embedding stay intact (re-embedding redacted
  text is a separate, deferred question tied to SEED-048's embedding pipeline).
- Replacing or breaking the shared provider-egress path — the gate is additive and
  provider-uniform, never a per-provider fork on the hot path.
- Full compliance certification (SOC2/ISO/HIPAA-BAA) — that's separately deferred; this
  seed is the *engineering* groundwork (the data-flow control), not the audit.
- Building it before SEED-004 tenancy + SEED-005 metadata land — the per-org policy
  needs the tenant model and the detection hook needs the per-field-confidence column.

## Relationship to sibling seeds

- **SEED-072 (Data-Subject Rights & Account Lifecycle)** + **SEED-075 (Backup, Restore &
  Disaster Recovery)** — the **compliance cluster** (072 ↔ 075 ↔ 079). All three are
  homeless procurement-security blockers sharing the same org-scoped surface and the same
  Enterprise/Compliance Readiness body of work co-designed with the v3.2 RLS rewrite.
- **SEED-005 (Enhanced Document Structure — next milestone)** — the **build home for the
  detection half**: the ingestion-time PII detector folds into SEED-005's custom-metadata
  + per-field-confidence extractor rather than running a second pass.
- **SEED-061 (context engineering)** — adjacent: it covers prompt poisoning/clash but
  explicitly **not** PII; this seed fills that gap on the same context-assembly path.
- **SEED-004 (org multi-tenancy)** — provides the tenant model the per-org policy scopes
  against; the policy hook co-designs with the v3.2 RLS rewrite.
- **SEED-048 (embeddings SPOF)** — adjacent on the ingestion/embedding path: any decision
  to re-embed redacted text touches the same embedding pipeline.
- **SEED-001 (scale readiness)** — the egress redaction pass is on the hot path; its
  per-request cost must be measured against the concurrency ceiling, not added blind.

## Links

`backend/app/services/documents.py:146` (`_upload_pipeline` — ingestion seam) ·
`supabase/migrations/034_dynamic_vector_match.sql` (`match_document_chunks` — retrieval seam) ·
`backend/app/services/anthropic_service.py:151` + `backend/app/services/openai_service.py:880` (provider-egress + `@traceable` log-capture seam) ·
`backend/app/main.py:76-80` + `backend/app/config.py:932` (`langsmith_tracing="true"` — on by default) ·
SEED-072 · SEED-075 · SEED-061 · SEED-005 · SEED-004 · SEED-048 · SEED-001 ·
investigation: workflow `wf_13ed5033`

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. An 8-agent cross-cutting gap hunt found that no PII-handling layer exists or is planned: documents ingest verbatim, retrieved chunks ship to third-party LLMs with no DLP gate, and LangSmith (on by default) captures full prompts including any PII in context — the single riskiest uncaptured governance hole for the B2B-first / co-tenant-SaaS vision and its regulated verticals.*
