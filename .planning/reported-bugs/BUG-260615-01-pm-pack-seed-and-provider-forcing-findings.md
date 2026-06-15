---
id: BUG-260615-01
title: PM-pack seed idempotency defects + DeepSeek/Gemini forced-emit reliability (Phase 104 live UAT)
reported: 2026-06-15
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [scripts/seed-pm-pack, backend/harness/forced-emit, provider-routing, model-registry]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-082]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 6e2f383e
  date: 2026-06-15
---

# BUG-260615-01: PM-pack seed idempotency defects + DeepSeek/Gemini forced-emit reliability

Found during Phase 104 live UAT (Claude-driven, local stack). Three dev-facing findings; none are
data-corruption (all honest), so severity is minor. The double-gate validator over-rejection found in
the same session was a BLOCKING bug and is already FIXED (commit `6a607169`) — recorded here for history.

## What we observed

**1. Seed dedup short-circuits on un-embedded `pending` rows (scripts/seed-pm-pack.py).**
A first seed run with `SEED_PM_RUN_INGEST` unset creates `documents` rows in `pending` (no storage, no
chunks). A later run *with* `SEED_PM_RUN_INGEST=1` sha256-dedups against those `pending` rows and
SKIPS `_upload_pipeline` → the corpus is never embedded. Workaround used: delete the empty `pending`
rows, then re-seed. Fix: the dedup should re-drive ingestion when an existing row is incomplete
(`pending`/0-chunk), not treat it as "already ingested".

**2. Seed published-def refresh (DELETE-then-INSERT) FK-violates once runs exist.**
`upsert_definition`'s DELETE of a published def raises `workflow_runs_definition_id_fkey` once any
`workflow_run` (e.g. a kickoff or golden run) references it. The FK correctly protects the def, but the
seed aborts instead of handling it. (Harmless when the def is unchanged; would block a real def refresh.)

**3. DeepSeek `deepseek-v4-pro` + Google `gemini-2.5-pro` honest-fail the FORCED structured emit.**
On the PM Weekly-Status emit (`llm_emit`/`render_template`), both return `model_failed_to_emit`
(`emit_forced → emit_failed`) — they narrate/truncate instead of forcing the tool-call field-map. NO
silent `.docx` is produced (the honesty guarantee holds), but they do not meet the FORCE-tier
"produce a clean cited `.docx`" bar. 4/7 providers (OpenAI gpt-4o, Anthropic claude-opus-4-8, MiniMax
MiniMax-M2.7, Z.ai glm-4.6) DID produce clean cited `.docx`. This is the known reasoning-model /
provider-forcing trap — needs service-boundary forcing tuning per provider (evidence-based).

**4. Model-list curation:** the Phase-104 SC#10 scoreboard pinned `gpt-5.4` / `MiniMax-M3`, which are
NOT in `MODEL_CAPABILITIES` (representative names) — substituted real served IDs `gpt-4o` /
`MiniMax-M2.7`. Only `gpt-4o` is exposed via `/models` (the kickoff still accepts registry IDs).

## Why it matters

(1)/(2) make the opt-in seed non-idempotent across the ingest-gate boundary and block a real def
refresh — dev/demo friction, not production. (3) is the substantive one: forced structured output
(emit, judge, NL-authoring) is a core cross-provider capability; DeepSeek/Gemini unreliability narrows
which providers can drive template-fill workflows. (4) is the curation pass the model-name memory predicted.

## Routing

(3) pairs with SEED-082 (emit-gate policy + model-fit routing) and the provider-feature-fit routing
direction — surface at the next provider/eval phase. (1)/(2) are a small `seed-pm-pack.py` hardening.
(4) is a model-registry curation pass. None block the Phase-104 content pack (all proofs green live).
