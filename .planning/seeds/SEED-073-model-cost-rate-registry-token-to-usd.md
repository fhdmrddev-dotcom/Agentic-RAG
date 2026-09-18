---
seed_id: SEED-073
title: Per-model cost-rate registry + token-to-USD conversion (the price table Phase 105 and v3.4 silently assume exists)
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: licensing / billing / cost — the single load-bearing primitive of the monetization dimension; a cost-conversion data layer + token-to-USD function, NOT a billing UI
related_seeds: [SEED-074, SEED-080, SEED-014, SEED-053, SEED-024, SEED-040, SEED-048, SEED-001]
related_memories: [project_v3_roadmap_locked, project_target_scale, project_provider_feature_fit_routing, feedback_prioritize_newest_models, project_cross_provider_native_tools_registry_trap]
related_decisions:
  - "D-PRD-10 (3-tier per-named-user pricing + add-ons; dollar amounts deliberately deferred until buyer signal — but the per-token rate that converts usage into those dollars was never designed)"
  - "SCHED-01 / Phase 105 ('no schedule without a budget' — REJECT-semantics on a USD ceiling that cannot be computed without this table)"
  - "v3.4 spend_caps DATA MODEL (spend_caps.limit_usd, spend_ledger per-run rollup, GET /admin/spend — solid design that is non-functional without a token→USD source)"
trigger_when:
  - Phase 105 (SCHED-01 scheduled triggers + budget caps) reaches spec-time — this is a HARD prerequisite; confront it BEFORE executing 101→102→…→105 or Phase 105 stalls mid-execution
  - v3.4 spend_caps / spend_ledger enforcement is scoped — limit_usd evaluation has no token→USD function without this
  - v3.0 Skill Studio adds eval cost reporting (a per-eval dollar figure needs the rate table)
  - v2.9 Phase 107 provenance receipt is scoped and cost is added as a receipt field
  - A B2B customer or the hosted-SaaS line needs per-tenant / per-run spend visibility in dollars
priority: high — the single least-captured item in the least-captured (monetization) dimension; a clean, concrete, blocking gap that a v2.9 STRETCH phase (105) and a locked v3.4 milestone both assume as already-present infrastructure.
suggested_phase: resolve at Phase 105 SCHED-01 spec-time (it is the hard shared prerequisite), then formalize in v3.4 spend_caps. NOT new v2.9 CORE work — but the dependency MUST be confronted before the 101→105 path reaches 105.
surface: Agentic-RAG
---

# SEED-073 — Per-model cost-rate registry + token-to-USD conversion

## The gap

Every spend-cap and budget design in the roadmap converts usage to dollars the
same way: `runs.input_tokens × per-model input rate + runs.output_tokens ×
per-model output rate`. v3.4 PRD §223's enforcement layer hand-waves "per-model
rate" as if it already exists, and Phase 105 SCHED-01's per-run token ceiling +
per-workflow daily cap rest on a USD figure. **No such rate table — and no
token→USD function — exists anywhere in the codebase.**

A grep of the entire backend for any pricing concept returns zero matches:

| Probe | Result | Evidence |
|---|---|---|
| `usd` / `cost_per` / `price_per` / `per_million` / `per_1k` / `MODEL_PRICING` / `rate_per_token` (case-insensitive) over `backend/app` | **0 matches** | grep-verified 2026-06-10 |
| The model registry that *could* hold a price | `MODEL_CAPABILITIES` (in `backend/app/config.py`) holds **capability flags only** (native_tools, max_output_tokens, timeouts) — **no price field** | `backend/app/config.py` (registry); also read at `threads.py`, `openai_service.py`, `settings.py` |
| Token columns to multiply against | **exist and are populated on the chat path** — `runs.input_tokens` / `output_tokens` written at finalization (`threads.py:1633`, `:2078`), with a missing-usage warning (`threads.py:1623`) | so the dependency is *not* "columns missing" — it is "no price to multiply by" |

So the per-model rate table, the **provider-price-versioning** question (prices
change over time, differ across the native-7, and OpenRouter is a **pass-through**
re-priced layer), and the token→USD conversion are entirely uncaptured. Phase 105
**cannot REJECT a run for exceeding a USD ceiling without this table**, and the
v3.4 `spend_caps.limit_usd` / cap-evaluation logic is structurally **non-functional**
without it.

Two further realities make this a *table*, not a constant:
- **Prices drift and differ.** Each of the native-7 (OpenAI, Anthropic, Google,
  DeepSeek, Moonshot, Z.ai/GLM, MiniMax) prices input and output tokens
  differently, providers change prices, and the newest-model bias
  (`feedback_prioritize_newest_models`) means the served model set churns. A
  hard-coded constant rots silently and undercharges/overcharges.
- **OpenRouter is pass-through.** It re-prices the underlying model and adds a
  margin, so its rate is neither the upstream provider's rate nor stable — it
  needs its own pass-through row, not an alias.

This is the **cost-conversion sibling** of SEED-074: even a perfect rate table
prices nothing on the workflow/harness path, because that path writes **null
tokens** (`harness_engine.py:1420-1421` finalizes the producer shell with
`input_tokens=None, output_tokens=None` and there is no child→producer rollup).
073 supplies the **price**; 074 supplies the **tokens to price**. Phase 105 needs
both.

## Why it matters at the product's target scale

The product must serve any scale from one codebase, with infrastructure left to
the buying company against published requirements; it is B2B-first with a possible
lighter hosted multi-tenant SaaS line, and pricing is per-named-user + add-ons
(D-PRD-10) with dollar amounts deferred until buyer signal. **Whatever the dollar
amounts turn out to be, the platform still has to convert observed token usage
into money** — for spend caps, for per-tenant visibility, for eval cost reporting,
and for any hosted-SaaS metering. That conversion has exactly one home, and it
does not exist yet.

This is the single load-bearing primitive of the entire monetization dimension,
and it is a **hard prerequisite on the immediate v2.9 path**, not a far-future
concern:

- **Phase 105 (a v2.9 STRETCH phase that ships FIRST as the SCHED-01 hard prereq)**
  literally cannot enforce "no schedule without a budget" — its central rule —
  against a USD ceiling it has no way to compute. Without this seed resolved at
  Phase 105 spec-time, Phase 105 stalls mid-execution.
- **v3.4 spend_caps / spend_ledger** is a solid design (scope global|org|routine,
  stacked most-restrictive-wins, RLS, GET /admin/spend, alert_threshold_pct,
  auto-pause) — but its `limit_usd` is inert without a token→USD source.
- **v3.0 Skill Studio** eval cost reporting and **v2.9 Phase 107** provenance
  receipts both want a dollar figure that requires this table.

## Why it is deferred / not now

It is not v2.9 CORE work — no shipped feature today *needs* a dollar figure, so
the gap stays invisible in single-operator dev. It is correctly *deferred to its
consumer*: the right moment to build it is Phase 105 SCHED-01 spec-time, where it
becomes load-bearing, then formalize the schema in v3.4 spend_caps. Building it
earlier than its first consumer would be speculative. The crucial action **now**
is not to build it but to **plant the dependency so it is confronted at Phase 105
spec, not discovered mid-execution** — and to add a cross-PRD note in v3.4 §223
that the rate table is net-new, not pre-existing infrastructure.

## Likely shape if promoted

Co-design with SEED-074 (token rollup) and SEED-080 (entitlement gating) — the
cost/entitlement triad. Candidate scope:

1. **A rate registry: provider × model × {input, output} rate, effective-dated.**
   Not a constant — a small table (or a `model_capabilities`-adjacent table)
   keyed `(provider, model, effective_from)` so a price change inserts a new
   effective row rather than mutating history; historical runs price against the
   rate in effect when they ran.
2. **OpenRouter as a first-class pass-through row**, not an alias of the upstream
   model — its margin-inclusive rate is distinct.
3. **A single `token_cost_usd(provider, model, in_tok, out_tok, at)` function** —
   the one source of truth every consumer calls (Phase 105 cap check, v3.4
   ledger rollup, v3.0 eval reporting, Phase 107 receipt). One home per concern.
4. **Source-of-truth + manual override.** A seeded default rate map (kept current
   with the newest-model curation pass) plus an operator-editable override — the
   same admin-tier substrate SEED-024 (settings unification) and SEED-040 /
   MOD-CAP-01 (model-capabilities override editor) already establish. The price
   row belongs next to the capability row.
5. **A "rate missing" fail-safe.** When a served model has no rate (a brand-new
   model added before its price is seeded), the conversion must fail *observably*
   (log + flag the run as unpriced) rather than silently costing $0 — the same
   honesty discipline as the existing `runs.usage missing` warning at
   `threads.py:1623`.

## Deliberately NOT in scope (when it lands)

The customer-facing **billing/subscription surface** (signup → plan → invoice →
dunning) — that is a separate, dormant, hosted-SaaS-gated concern. The **dollar
amounts** of the tiers (D-PRD-10 keeps those deferred until buyer signal — this
seed is about the *per-token rate*, a different number). The **token-capture
plumbing** on the harness path (that is SEED-074). The **entitlement check** that
reads org tier to decide *whether* a cap applies (SEED-080). This seed is *only*
the cost-conversion data layer + the one conversion function.

## Links

`backend/app/config.py` (MODEL_CAPABILITIES — the registry that needs a price
column / sibling rate table) · `backend/app/api/threads.py:1623,1633,2078`
(chat-path token capture — the usage this would multiply by; `:1623` missing-usage
warning is the honesty pattern to mirror) · `backend/app/services/harness_engine.py:1420-1421`
(the null-token write that SEED-074 must fix before this prices anything) ·
v3.4 PRD §223 (the "per-model rate" hand-wave — needs a net-new note) ·
Phase 105 SCHED-01 ("no schedule without a budget") · D-PRD-10 (pricing posture) ·
investigation: alignment sweep workflow `wf_13ed5033`

**Sibling-seed map:**
- **SEED-074** — workflow/harness + sub-agent token-usage rollup to the producer run. **The other half of the same blocker:** 073 = the price, 074 = the tokens. **Both are HARD prerequisites of Phase 105** — neither alone makes a per-workflow budget computable.
- **SEED-080** — entitlement / feature-gating primitive (tier + add-on enforcement). The third leg of the **cost/entitlement triad (073 ↔ 074 ↔ 080)**: 080 reads org tier to decide which cap applies; 073 converts the usage that cap measures; 074 supplies the usage. Likely co-scoped as one "Cost & Entitlement Foundations" theme.
- **SEED-014** — cost-runaway protection (the intent that anchors v3.4 Theme F + Phase 105 "no schedule without a budget"). 073 is the metering primitive that makes that intent enforceable.
- **SEED-053** — sub-agent events surfaced up to the producer. SEED-074 may extend it to carry token counts; 073 then prices those counts.
- **SEED-024 / SEED-040** — settings unification + model-capabilities override editor. The admin-tier substrate the rate registry + manual override should live alongside (the price row next to the capability row).
- **SEED-048** — embeddings SPOF. Embedding calls also consume tokens at a (different) rate; the registry should cover the embedding model too, not just chat models.

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. Surfaced as the single least-captured item in the least-captured (monetization) dimension: a grep of the backend for any pricing concept returns zero matches, yet a v2.9 STRETCH phase (105) and a locked v3.4 milestone both treat the per-model rate table as already-present infrastructure. It is a HARD shared prerequisite of Phase 105 SCHED-01 alongside SEED-074 — confront it at Phase 105 spec-time, not mid-execution.*
