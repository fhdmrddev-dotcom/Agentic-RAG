---
seed_id: SEED-074
title: Workflow/harness + sub-agent token-usage rollup to the producer run — the metering primitive Phase 105 silently assumes (workflow runs record NULL tokens today)
status: partially-answered
partial: true
folded_into: "256"
status_note: "Flipped from `planted` at Phase 256 (plan 256-02, R-5). METER-03/04/05/06 close the persistence + rollup arms; ⛔ step 4 (cross-provider parity, full native roster) is NOT discharged — nothing in Phase 256 drives a live provider. NOT `answered`, NOT `shipped`."
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: licensing / billing / cost — a run-finalization metering seam, NOT a new feature; the missing rollup that turns harness/sub-agent token usage into a per-workflow number
related_seeds: [SEED-073, SEED-080, SEED-053, SEED-036, SEED-048]
related_memories: [project_v29_milestone_started, project_target_scale, project_v3_roadmap_locked, feedback_business_value_framing, feedback_cross_provider_full_native_roster]
related_decisions:
  - "REQUIREMENTS.md:99 — Phase 105 spec re-confirmation (c): 'does the shared gateway uniformly capture token usage across all 7 providers (the spend-meter prerequisite for SCHED-01)?' — asks about the GATEWAY capture but NOT about the harness/sub-agent rollup; this seed is the un-asked half"
  - "Phase 105 SCHED-01 — 'no schedule without a budget' (REJECT-semantics, disabled-by-default) is enforced against runs that currently record zero token usage on the workflow path"
trigger_when:
  - Phase 105 (SCHED-01, the v2.9 STRETCH budget/scheduling phase) enters spec or discuss — this is a HARD prerequisite; re-confirm it at REQUIREMENTS.md:99 BEFORE executing 101→…→105
  - Phase 107 (provenance receipt) is scoped and cost is added as a receipt field — a per-run cost number needs non-null per-run tokens
  - v3.4 spend_caps / spend_ledger per-run rollup is planned — the ledger keys on the runs token columns the harness path leaves NULL
  - v3.0 Skill Studio multi-agent orchestration adds cost attribution — sub-agent token aggregation becomes load-bearing
  - SEED-073 (per-model cost-rate registry) is promoted — a price table without per-run tokens still cannot compute a per-workflow dollar figure; these two ship together
priority: high — a HARD, load-bearing prerequisite for Phase 105 (the v2.9 STRETCH phase that ships FIRST as the SCHED-01 budget gate). Phase 105's entire premise is structurally impossible against workflow runs that record NULL tokens, regardless of any price table.
suggested_phase: confront at Phase 105 spec time (re-confirm at REQUIREMENTS.md:99) and resolve BEFORE executing toward 105 — co-planned with SEED-073 (price table) and SEED-080 (entitlement gate) as the cost/entitlement triad. NOT a v2.9 CORE phase; a STRETCH-105 enabler.
surface: Agentic-RAG
---

# SEED-074 — Workflow/harness + sub-agent token-usage rollup to the producer run

---

## ⚠ STATUS 2026-09-18 — PARTIALLY ANSWERED by Phase 256, and THREE BODY CLAIMS BELOW ARE MEASURABLY STALE

**Nothing below this block is deleted or rewritten.** The originals stand verbatim, because this
register's own recurring finding is that a corrected claim recorded *beside* its original teaches
the next reader something a silent overwrite does not.

### What Phase 256 closes

`METER-03/04/05/06` — the workflow producer run now **persists** its token totals, sub-agent usage
**rolls up** into the run-level box, and the `input_tokens=None` finalize sites are either closed or
**named in the register** (`SEED-297`, `SEED-299`).

### ⛔ What Phase 256 does NOT close — the reason this is `partially-answered` and not `answered`

**Step 4, the cross-provider parity check.** This seed asks for verification against the full native
roster with *real cross-provider workflow runs*. **Nothing in Phase 256 drives a live provider at
all.** The rollup is proven by unit fences over fake event streams, which is the right proof for the
arithmetic and **no proof whatsoever** for per-provider usage-emission quirks. ⛔ Do not read this
seed's status as covering step 4. Step 5 (the missing-usage warning on the workflow path) is added
by `METER-05`.

### The three stale claims, corrected beside the originals

| What the body below says | Measured 2026-09-18 |
|---|---|
| *"`harness_engine.py:1413-1421` … the only `finalize_run` call in the engine"* | ⚠ **The line numbers have MOVED.** The producer-shell finalize is now at **`harness_engine.py:3044-3053`**. The claim was true when written; the file has grown to 3135 lines across 20 phases. |
| *"`sub_agent_service.py` (no rollup of per-sub-agent usage into the producer/workflow run)"* | ⛔ **FALSE, and it has been false since Phase 093/204 — long before Phase 256.** `backend/app/services/harness/phase_types.py:768 `_record_run_usage`` sums each completed sub-agent into the run-level box, and `:829` threads that box into the sub-agent spawn. Flagged independently by `256-PREFLIGHT.md` §3 and re-confirmed here. ⭐ **A seed can rot into being wrong about the DEFECT, not merely about a line number** — this one under-stated how much was already built, for roughly a year. |
| *"Decide the storage shape … (b) add a per-phase usage table"* | **Resolved as option (a)** — columns on `workflow_runs` — by **D-256-06**. ⚠ **The per-phase table is NOT built.** The body below calls (b) *"the more future-proof shape"*; that is a **preference, not a decision**, and a future reader must not cite it as one. |

### Siblings this phase planted

`SEED-297` (the boot reconciler NULLing a `cap_paused` run's real totals) · `SEED-298`
(`max_tokens_per_run` is really per-SEGMENT, and only exists on a schedule) · `SEED-299` (a stranded
Deep chat run's count is genuinely unknowable) · `SEED-300` (three token holes surviving Phase 256,
including an eval **judge shot** counted nowhere).

⛔ **`SEED-073` is deliberately UNTOUCHED** — it is the price table (METER-01/02, Phase 257), and
nothing in Phase 256 builds a rate. The triad's *count* half is what moved here; the *rate* half has
not.

---

## The gap (grounded in current code)

Phase 105 (SCHED-01) makes "no schedule without a budget" a hard rule and rejects
runs that exceed a per-workflow ceiling. A grounded code read on 2026-06-10
(workflow `wf_13ed5033`, the Phase 101 future-milestone alignment sweep) **verified
live in the finalization code** that the harness/workflow execution path records
**NULL token usage** — so Phase 105 would meter exactly the runs that carry no data:

| Path | Token-usage behavior at finalize | Evidence |
|---|---|---|
| **Deep / chat** | Finalizes runs **WITH tokens** — populates `input_tokens`/`output_tokens` from the running totals, and even **logs a warning when usage is missing** | `threads.py:1633-1634` (`input_tokens=_input_tokens_total`, `output_tokens=_output_tokens_total`); a second site at `threads.py:2078-2079` (`input_tokens=_in_tok`, `output_tokens=_out_tok`); missing-usage warning at `threads.py:1623` ("runs.usage missing for run=…") |
| **Harness producer shell** | Finalizes the workflow producer run with **`input_tokens=None, output_tokens=None`** — the producer shell makes no LLM calls itself, and there is **NO rollup** summing child phase-run usage up into the producer run | `harness_engine.py:1413-1421` (the only `finalize_run` call in the engine; `_pid = ctx.producer_run_id`, then `input_tokens=None, output_tokens=None`) |
| **Sub-agents** | Sub-agent token usage is **not aggregated** to any parent run | `sub_agent_service.py` (no rollup of per-sub-agent usage into the producer/workflow run) |

**The structural consequence:** workflow-mode runs — *exactly what Phase 105
schedules and what all of v2.9 is about* — carry `input_tokens=NULL`,
`output_tokens=NULL` on the `runs` row. The phase children may each meter their
own LLM calls, but nothing sums those into the workflow's producer run, and
nothing rolls sub-agent usage into a parent. Even **with** a per-model price table
(SEED-073), a per-workflow budget is **structurally impossible** to compute,
because there is no per-run token number to multiply by the rate.

**The dependency is invisible.** The one place the spec asks about tokens —
`REQUIREMENTS.md:99`, the Phase 105 spec re-confirmation — asks whether *"the
shared gateway uniformly captures token usage across all 7 providers"*. That is the
**gateway-capture** half (and the chat path proves the gateway does capture). It
**never asks** whether the **harness producer / sub-agent paths roll those captured
tokens up** into the workflow run — and they don't. The v2.6→v3.4 token-column
concern (SUMMARY §E.2 #2) was flagged MEDIUM and is **closed for the chat path**;
it was **never assessed for the workflow/harness path that v2.9 itself introduced.**

## Why it matters at the product's target scale

The operator's direction (2026-06-10): the product must **serve any scale from one
codebase**, with infrastructure left to the buying company against **published
requirements**, **B2B-first** with a possible **lighter hosted multi-tenant SaaS
subscription** alongside; licensing is TBD; the single-VPS plan (Phase 080) was
operator self-testing ONLY. (See `project_target_scale` + `project_v29_milestone_started`.)

Within that, **cost-metering is the revenue substrate** of both the B2B and the
hosted-SaaS motions, and v2.9 is the milestone that puts **durable, scheduled,
unattended workflow runs** on the platform — the runs most likely to silently burn
budget. Against that vision the NULL-token workflow path is a near-term blocker, not
a distant one:

- **Phase 105 (a v2.9 STRETCH phase that ships FIRST as the SCHED-01 hard prereq)
  literally cannot enforce a USD or token ceiling** on a workflow whose `runs` row
  records `NULL` tokens. "No schedule without a budget" is unenforceable against
  zero data.
- **Phase 107 (provenance receipt)** wants cost as a natural receipt field — a per-run
  cost requires non-null per-run tokens.
- **v3.4 `spend_ledger`** does its per-run rollup keyed on the `runs` token columns;
  the harness path leaves them NULL, so the ledger under-counts every workflow.
- **v3.0 Skill Studio multi-agent orchestration** needs per-sub-agent cost attribution
  — the same un-aggregated sub-agent usage.

This is one of the **two cost-metering blockers that gate the immediate v2.9 path**
(the other is SEED-073, the price table). Both must be confronted at Phase 105 spec
time or Phase 105 stalls mid-execution.

## Why it is deferred / not now

It is **not a Phase 101 concern** (Phase 101 is the template-fill / `render_template`
phase and touches none of the finalization paths). It is **not v2.9 CORE** — it is a
STRETCH-105 enabler, and Phase 105 is itself a STRETCH phase. It is deferred only in
the sense that no phase before 105 needs it; the moment Phase 105 enters spec it
becomes a **hard, must-resolve-first** dependency, which is why the re-open trigger is
"Phase 105 spec/discuss" rather than a distant milestone. Resolving the gateway-capture
question at `REQUIREMENTS.md:99` is **necessary but not sufficient** — the rollup is the
un-asked second half and must be re-confirmed alongside it.

## Likely shape if promoted

Resolve at Phase 105 spec time, co-planned with SEED-073 (price table) and SEED-080
(entitlement gate). Candidate scope, ordered:

1. **Roll child phase-run usage up into the producer run.** At producer-shell
   finalize (`harness_engine.py:1413-1421`), sum the `input_tokens`/`output_tokens`
   of every child phase-run for the workflow into the producer run's columns instead
   of writing `None`. The chat path already proves the per-call capture works
   (`threads.py:1633-1634`) — this is aggregation, not new instrumentation.
2. **Aggregate sub-agent usage to its parent.** In `sub_agent_service.py`, carry each
   sub-agent's token usage up to the parent run on completion (a sub-agent of a
   workflow phase should count against that workflow). Reuse / extend SEED-053's
   sub-stream→producer event plumbing to also carry token counts (see below).
3. **Decide the storage shape.** Either (a) aggregate into the producer run's existing
   `input_tokens`/`output_tokens` columns (cheapest, ledger-compatible), or (b) add a
   **per-phase usage table** for drill-down (per-phase / per-sub-agent attribution that
   v3.0 multi-agent and Phase 107 receipts can read), with the producer columns as the
   roll-up of that table. The per-phase table is the more future-proof shape.
4. **Cross-provider parity check.** The rollup must be honest across the full native
   roster — OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax, plus
   OpenRouter pass-through — since each surfaces usage differently and some
   (DeepSeek/Moonshot reasoning models) have known usage-reporting quirks. Verify with
   real cross-provider workflow runs, not a single provider. (See
   `feedback_cross_provider_full_native_roster`.)
5. **Surface the missing-usage warning on the workflow path too.** The chat path warns
   on missing usage (`threads.py:1623`); the workflow path should fail loud (or warn)
   when a child run that should have tokens reports none, so a NULL never silently
   propagates into a budget calc.

## Deliberately NOT in scope (when it lands)

The price-per-token conversion itself (that is SEED-073 — token counts × per-model
USD rate); the budget-cap **enforcement** logic and REJECT-semantics (that is Phase
105 SCHED-01 / v3.4 `spend_caps`); the spend-visibility UX / dashboard (Phase 105
discuss + v3.4 `GET /admin/spend`); the entitlement/tier gate that decides *who* gets
a budget (SEED-080); changing how individual LLM calls are metered (the gateway
already captures usage — this seed only aggregates what is already captured). This is
a **rollup seam**, not a re-instrumentation.

## Relationship to sibling seeds (the cost / entitlement triad)

- **SEED-073 — Per-model cost-rate registry + token→USD conversion.** The other half
  of the metering primitive. SEED-073 supplies the **rate** (USD per token, per model,
  effective-dated); SEED-074 supplies the **count** (tokens per workflow run). **A
  per-workflow dollar budget needs BOTH** — neither alone unblocks Phase 105. Ship them
  together.
- **SEED-080 — Entitlement / feature-gating primitive.** The tier/add-on gate that
  decides *whether* a given org gets a budget cap and at what tier. The cost/entitlement
  triad is **073 ↔ 074 ↔ 080**: 073 = price, 074 = usage, 080 = who-pays-what. All three
  are HIGH and converge on Phase 105 + v3.4.
- **SEED-053 — Sub-stream tool/search events → producer timeline.** Already wants
  sub-agent events surfaced up to the harness producer stream (it ships the
  producer-honest subset and defers per-phase tool/search *counts*). The cleanest
  implementation of SEED-074 step 2 is to **extend SEED-053's plumbing to also carry
  token counts**, rather than build a parallel rollup channel.
- **SEED-036 — `task()` sub-agent global-concurrency quota.** Same sub-agent surface;
  036 caps *concurrency*, 074 *meters cost* of the same fan-out. They co-touch
  `sub_agent_service` and naturally co-plan.
- **SEED-048 — Embeddings SPOF.** Ingestion/search embedding token cost is a separate
  metering surface; note it so a future cost picture is complete, but it is out of this
  seed's scope (this seed is chat/workflow LLM-call rollup).

## Links

`backend/app/services/harness_engine.py:1413-1421` (the producer-shell finalize that writes `input_tokens=None`/`output_tokens=None`) ·
`backend/app/api/threads.py:1633-1634` + `:2078-2079` (the chat path that DOES populate tokens) · `threads.py:1623` (the missing-usage warning the chat path has and the workflow path lacks) ·
`backend/app/services/sub_agent_service.py` (sub-agent usage, not aggregated) ·
`.planning/REQUIREMENTS.md:99` (Phase 105 spec re-confirmation (c) — asks the gateway-capture half, not the rollup half) ·
SEED-073 (price table) · SEED-080 (entitlement gate) · SEED-053 (sub-stream events → producer timeline) · SEED-036 · SEED-048 · investigation: workflow `wf_13ed5033`

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. The sweep verified in live finalization code that the Deep/chat path records tokens (`threads.py:1633-1634`, with a missing-usage warning) but the harness producer shell finalizes with `input_tokens=None`/`output_tokens=None` (`harness_engine.py:1413-1421`) and nothing rolls child phase-run or sub-agent usage up — so workflow-mode runs, the exact runs Phase 105 schedules and meters, carry NULL token data. With or without a price table (SEED-073), a per-workflow budget is structurally impossible until this rollup exists. The dependency is invisible because REQUIREMENTS.md:99 asks whether the gateway captures tokens, never whether the harness/sub-agent paths roll them up.*
