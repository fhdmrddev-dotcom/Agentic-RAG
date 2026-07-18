# Phase 159: Model Registry Curation — Discussion Log

**Date:** 2026-07-18
**Mode:** discuss (default), no flags
**Participants:** operator + Claude

> Human-reference record (audits / retrospectives). NOT consumed by downstream agents — that's `159-CONTEXT.md`.

## Framing established before questions

- Phase 149 already shipped the discovery propose→confirm flow, the registry editor (070-A/071-A), and the honesty rules (new models land disabled; capabilities never auto-guessed). Scope of 159 is a curation/UX layer on top.
- **Key scout finding:** the suitability filter regex already exists in `scripts/curate_models.py` (`_MISSING_EXCLUDE` + flagship-family include filters) — it was never wired into the live discovery service. So the filter is a lift, not a design.
- No add-model-by-ID UI exists today → that path is genuinely new.

## Reported-bugs cross-check (mandatory)

- **BUG-260714-01** (gpt-5.6 parameter error → gpt-4o fallback; `affected_areas: [backend/model-registry, provider/openai, chat/streaming]`) surfaced as the one open Agentic-RAG report overlapping the domain.
- **Decision: LEAVE OPEN (not folded).** Root cause = OpenAI-adapter provider parameter, not registry curation; belongs with the OpenAI-adapter work (SEED-114 / D-149-16). Operator did not object to the recommendation.

## Areas selected to discuss

Operator selected **all four** gray areas.

## Decisions

| Area | Options presented | Selected | → CONTEXT |
|------|-------------------|----------|-----------|
| **Filter aggressiveness** | Exclude-list (Rec) · Family allowlist · Layered both | **Exclude-list** — reuse the proven curate_models regex, hide utility models, show everything else, "show all" opt-in; never wrongly hides a new chat family | D-159-01 |
| **Add-by-ID: where/shape** | Dedicated form (Rec) · Both · Filtered discovery only | **Dedicated form** — "+ Add model by ID" in the registry tab (id + provider + 3 knobs → DB-only row, lands disabled); discovery stays for "what's new" | D-159-02 |
| **Capability defaults** | Hybrid source-labeled (Rec) · Family defaults always · Blank (149 status quo) | **Hybrid, source-labeled** — provider-returned > family-default ("default — confirm") > blank; sources visually distinct; still lands disabled + explicit enable | D-159-03 |
| **Filter scope + persistence** | Discovery-only + persisted (Rec) · Discovery + registry search · Session-only | **Discovery-only + persisted** — filter in the discovery panel, default-on, persisted operator app_setting, "show all" opt-in; registry table unchanged | D-159-04 |

All four resolved to the recommended option in a single pass.

## Notable nuance captured for the planner

- The `curate_models.py` exclude regex was written for `CURATE_MISSING` (registry-gap flagging) and also excludes `chatgpt|instruct|codex|davinci|babbage` — some of which ARE valid chat models. The planner must tune the final chat-filter token set with evidence from a live discovery pull, and DRY the regex to one shared source (D-159-01).

## Deferred

- Flagship-family allowlist tightening toggle (Q1 alt) — deferred unless exclude-list proves noisy.
- Registry-table search — deferred (registry already curated).
- Live capability probing — out (defaults + confirm is enough).

## Companion work (context only)

- Model-icons picker polish (provider + model `@lobehub` logos, composer + Settings model list) already shipped ad-hoc as `0d81d088` (2026-07-18) — not re-scoped here.

---

*Next: `/gsd:plan-phase 159`*
