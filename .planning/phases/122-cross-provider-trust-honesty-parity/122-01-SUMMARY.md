---
phase: 122-cross-provider-trust-honesty-parity
plan: 01
subsystem: provider-gateway / capability-registry
tags: [MP-02, emit_tier, forced-emit, cross-provider, deepseek-demotion, gateway-boundary, tdd]
requires:
  - "MODEL_CAPABILITIES registry (config.py) — 55 rows with forced_emission/strict_json_schema bools"
  - "openai_service.py force_tool_name forcing branch (Phase 101.1 D-15 seam)"
provides:
  - "emit_tier Literal[force_strict|force|coerce] on every ModelCapability row — single source of truth (D-122-04)"
  - "default-SAFE coerce on a registry miss (get_model_capability(...).get('emit_tier','coerce'), D-122-05)"
  - "tier-driven strict gate: json_schema response_format requested whenever strict_response_format is true (no provider-name check)"
  - "the substrate the MP-01 ladder (Plan 122-02) reads to build its rung list"
affects:
  - "backend/app/services/forced_emit.py (Plan 122-02 will read emit_tier directly)"
  - "scripts/eval_cross_provider.py (Plan 122-03 --forced-emit scoreboard reads declared_emit_tier)"
tech-stack:
  added: []
  patterns:
    - "explicit enum replaces implicit two-bool guess (emit_tier supersedes forced_emission+strict_json_schema)"
    - "tier-driven (by measurement) replaces provider-name special-casing (by name)"
    - "default-SAFE capability resolution (.get(field, safe_default))"
key-files:
  created:
    - "backend/tests/unit/test_config_registry.py"
  modified:
    - "backend/app/config.py"
    - "backend/app/services/openai_service.py"
    - "backend/tests/unit/test_gateway_forcing.py"
decisions:
  - "Kept the two old bools (forced_emission/strict_json_schema) in place but deprecated-unread for one phase (D-122-04 / RESEARCH Open Q1 — safer rollback); did NOT add a derived emit_tier view that re-reads strict_json_schema (avoids re-introducing the DeepSeek guess — Pitfall 3)"
  - "Removed the now-dead `import copy` from openai_service.py (Rule 3 — blocking cleanliness directly caused by removing the deep-copy strict block)"
metrics:
  duration: "~29 min"
  tasks: 2
  files: 4
  completed: "2026-06-23"
---

# Phase 122 Plan 01: emit_tier Registry Migration + Provider-Gate Removal Summary

Replaced the implicit two-bool forcing guess (`forced_emission` + `strict_json_schema`) **and** the hardcoded `provider == "openai"` strict gate with a single explicit, doc-verified `emit_tier` enum (`force_strict | force | coerce`) on every `MODEL_CAPABILITIES` row, demoting the 2 DeepSeek rows out of strict (inert without a `/beta` base_url) and making `force_strict` mean "OpenAI by measurement, not by name."

## What Was Built

**Task 1 — `emit_tier` field + 55-row migration + registry invariant test (TDD):**
- Added `emit_tier: Literal["force_strict", "force", "coerce"]` to the `ModelCapability` TypedDict (beside `capability_source`/`strict_json_schema`) with a D-122-04 comment naming it the single source of truth and default-SAFE `coerce`. The two old bools are kept but explicitly marked DEPRECATED-UNREAD.
- Migrated all 55 rows per the locked mapping: **14** OpenAI → `force_strict`; **2** DeepSeek (`deepseek-v4-flash`/`deepseek-v4-pro`) → `force` (DEMOTED, inline `# DEMOTED — strict inert` comment); **34** other forced rows (6 anthropic + 8 google + 8 minimax + 7 zhipu + 5 conditional openrouter) → `force`; **5** Kimi/Moonshot rows (+ 2 openrouter kimi routes) → `coerce`. Final split locked at **14 force_strict / 36 force / 5 coerce = 55**.
- New `backend/tests/unit/test_config_registry.py` (8 invariants): every row has a valid `emit_tier`; force_strict ⊆ OpenAI (exactly 14); no non-OpenAI force_strict; deepseek is force; GLM/zhipu is force; the locked 14/36/5 count; registry-miss defaults coerce.

**Task 2 — provider-name gate + inert DeepSeek strict removal + gateway-capture test (TDD):**
- In `openai_service.py`'s `force_tool_name` branch: removed the function-level `_fn["strict"] = True` deep-copy loop (inert for DeepSeek; OpenAI's guarantee comes from the `response_format` json_schema, not a function flag — A4); removed the `and provider == "openai"` name check so the json_schema `response_format` is built whenever `strict_response_format` is true (tier-driven).
- Extended `test_gateway_forcing.py` with 3 captures: `test_no_provider_gate` (force_strict on a non-openai provider context still requests the json_schema response_format — the load-bearing removal), `test_deepseek_force` (force-tier deepseek carries no function-level strict + no response_format), `test_openai_force_strict_preserved` (A4 — OpenAI force_strict still emits json_schema response_format).
- Removed the now-dead `import copy` (its only user was the deleted strict block).

## How It Was Verified

- `pytest test_config_registry.py` → **7/7 pass** (8th, the counts test, runs under the full-file run; `-k emit_tier` selects 3); confirms 14/36/5 split + default-SAFE coerce + deepseek demotion.
- `pytest test_gateway_forcing.py -k "no_provider_gate or deepseek_force or openai_force_strict"` → **5/5 pass** (GREEN; was RED on `test_no_provider_gate` before the gate removal).
- `pytest test_gateway_forcing.py test_103_forced_emit_strict.py test_forced_emit.py test_config_registry.py test_provider_gateway_seam.py` → **49/49 pass** — no regression in the forcing/gateway/registry/seam suite. The 103 strict tests (which assert `request.strict_schema` at the `forced_emit` level, not the function flag) are unaffected.
- Live source probe confirmed `deepseek-v4-flash`/`deepseek-v4-pro` → `force`; tier counts `{force_strict: 14, force: 36, coerce: 5}`, total 55.
- Diff-verified Pitfall 5 seams untouched: DeepSeek thinking-off (`:1521-1526`) and 111.1 local-provider routing (`:1449-1456`) show no edits.
- Full backend suite: **1814 passed / 120 failed** — every failure is in unrelated domains (retrieval, sql, sandbox-harvest, streaming, mdl, threads-skills — the documented pre-existing AsyncMock/coroutine baseline from Phase 075.4 TEST-TRIAGE + Phase 120). **ZERO failures in any file/domain this plan touched** (grep-confirmed); the plan's two created/modified test files are 100% green (22/22).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed now-dead `import copy`**
- **Found during:** Task 2
- **Issue:** Removing the function-level strict deep-copy loop left `import copy` (line 3 of `openai_service.py`) as the only-now-unused import — a lint/cleanliness regression directly caused by the task's deletion.
- **Fix:** Removed the `import copy` line after grep-confirming `copy.` appears nowhere else in the file.
- **Files modified:** `backend/app/services/openai_service.py`
- **Commit:** `004b87a1`

No other deviations — the registry mapping, gate removal, and tests matched the plan exactly.

## Known Stubs

None. No placeholder values, no hardcoded-empty data, no unwired components. `emit_tier` is populated on every row; the old bools are intentionally retained-but-unread per D-122-04 (documented in-code, resolved by Plan 122-02 reading `emit_tier` directly).

## Notes for Downstream

- **Plan 122-02 (MP-01 ladder):** reads `emit_tier` directly via `get_model_capability(model).get("emit_tier", "coerce")`. The ladder must NOT mutate the registry (D-14 red line). `force_strict → [strict_force, non_strict_force, coerce, fail]`; `force → [non_strict_force, coerce, fail]`; `coerce → [coerce, fail]`.
- **Caller contract:** `strict_response_format` must be set by the `forced_emit` caller ONLY for `emit_tier == "force_strict"` shots. Post-migration that is OpenAI-only by measurement; `openai_service.py` no longer enforces this by provider name.
- **Old bools deprecated-unread:** `forced_emission` / `strict_json_schema` remain on the rows for one-phase rollback safety. A future cleanup phase removes them once `emit_tier` is proven in production.

## Self-Check: PASSED

- Files verified on disk: `test_config_registry.py`, `config.py`, `openai_service.py`, `test_gateway_forcing.py`, `122-01-SUMMARY.md` — all FOUND.
- Commits verified in git log: `43b09e42` (RED test), `f6bcbeb3` (registry migration), `36d4522d` (RED gateway tests), `004b87a1` (gate removal) — all FOUND.
