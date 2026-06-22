---
id: BUG-260615-01
title: PM-pack seed idempotency defects + DeepSeek/Gemini forced-emit reliability (Phase 104 live UAT)
reported: 2026-06-15
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [scripts/seed-pm-pack, backend/harness/forced-emit, provider-routing, model-registry]
folded_into: "122"
verified_closed_by: null
related_seeds: [SEED-082]
re_open_trigger: "FOLDED into Phase 122 (2026-06-23, /gsd:discuss-phase): finding (3) — the TIER-FORCE 400 → null-without-non-strict-retry defect — is the LIVE EVIDENCE for MP-01 (the force→non-strict→coerce ladder in forced_emit, D-122-01/02) + MP-02 (explicit doc-verified emit_tier, D-122-04). Verify-close 122 only when the ladder recovers the schema-specific 400s and the default-config metadata extraction no longer silently emits null. Findings (1)/(2)/(4) are seed-pm-pack idempotency + model-registry curation — NOT owned by 122; leave those tracked here. Prior (Phase 111 discuss, 2026-06-15): LEFT OPEN; 111's SC#4 = pass-OR-documented per provider + graceful degradation; re-route the forcing fix to a provider-feature-fit/eval phase — now done (122)."
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

## Fix status (2026-06-15, post-104 code review)

- **(2) PARTIALLY FIXED** (WR-02, commit pending): `upsert_definition` now compares PARSED dicts
  (`json.loads(existing) == def_dict`) instead of `json.dumps` vs Postgres-normalized text, so a NO-OP
  refresh is genuinely idempotent and no longer DELETE-then-INSERTs (which FK-violated once runs
  referenced the def). A genuine def-CONTENT change while runs reference the published row would still
  need handling (the immutability model favors a NEW version, not deleting a referenced one) — leave open.
- **(1) OPEN** — dedup short-circuit on un-embedded `pending` rows (the re-drive-ingestion fix).
- **(3) OPEN** — DeepSeek/Gemini forced-emit reliability (provider-tuning; pairs with SEED-082).
- **(4) OPEN** — model-list curation (the scoreboard harness IDs were fixed to `gpt-4o`/`MiniMax-M2.7`).
- The BLOCKING double-gate over-rejection (not in this report's scope) is FIXED (commit `6a607169`).

## Phase 111 live UAT extension (2026-06-16) — sharpens finding (3)

Phase 111's SC#4 4-axis cross-provider UAT (Claude-driven: minted-JWT API uploads + psycopg2 :54322
+ backend log-sink provider-endpoint verification) re-exercised forced structured emit on a DIFFERENT
schema — the dynamic `emit_document_metadata` tool (7 optional `anyOf[..,null]` built-ins + a custom
field + a `confidence` `dict[str,float]` → `{type:object, additionalProperties:{type:number}}`). New
evidence that refines (3):

- **gpt-4o AND glm-4.6 ALSO 400 on THIS schema** — not just DeepSeek/Gemini. In the 104 deliverable
  context these three produced clean output; on the 111 metadata schema OpenAI gpt-4o, DeepSeek
  deepseek-v4-pro, and Z.ai glm-4.6 ALL return `400 Bad Request` on the TIER-FORCE chat-completion
  (`logs/backend.60452.log` lines 117/179/220). So the failing set is **schema-specific**, not a fixed
  provider list — the metadata schema's optional-heavy + `additionalProperties` confidence object trips
  the OpenAI-schema-validation family (OpenAI/DeepSeek/Z.ai) where the 104 deliverable schema did not.
- **Root cause localized:** a direct repro proved OpenAI ACCEPTS the raw `emit_document_metadata`
  schema in NON-strict mode (`OK tool_calls=True`, both builtins-only and with-custom-field). Yet the
  live `forced_emit` TIER-FORCE 400s despite the caller passing `strict=False` (plumbed at
  `forced_emit.py:248/292`), and then degrades straight to null **without a non-strict COERCE retry**.
  ⇒ the defect is in the shared forced_emit/gateway TIER-FORCE strict handling (and missing non-strict
  fallback), not in the per-call `strict` flag and not in Phase 111's schema construction.
- **Impact bumped:** because metadata extraction defaults to gpt-4o (`resolve_extraction_model` env
  fallback), the **default config silently extracts no metadata** until this is fixed — higher
  real-world impact than the 104 framing suggested. Anthropic claude-sonnet-4-6, Moonshot kimi-k2.6,
  MiniMax MiniMax-M2.7, and OpenRouter deepseek/deepseek-chat all returned full confidence-scored
  metadata (incl. the live custom `contract_value` field), so the dynamic-schema + confidence path
  itself is proven cross-provider.
- Google gemini-2.5-flash failed here on a **429 quota** (transient), a separate cause from the 400s.

Disposition unchanged: still OPEN, still pairs with SEED-082, still NOT owned by Phase 111 (111's SC#4
acceptance = pass-OR-documented-per-provider + graceful degradation, which HELD — every doc completed,
none stuck). Route the forced_emit strict-400 + non-strict-retry fix to the provider-feature-fit / eval
phase. Evidence: Phase 111 `111-HUMAN-UAT.md` Test 1 + `scripts/_uat111/results.json`.
