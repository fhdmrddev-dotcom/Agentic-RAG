---
phase: 122-cross-provider-trust-honesty-parity
verified: 2026-06-23T09:00:00Z
status: passed
score: 5/5
human_items_closed: 2026-06-23T10:30:00Z  # all 3 human_verification items ran + PASSED (122-HUMAN-UAT.md 3/3); live --forced-emit scoreboard committed + SC#10 panel UAT passed on all providers
overrides_applied: 0
human_verification:
  - test: "Run scripts/eval_cross_provider.py --forced-emit against local Supabase with live native-7 keys"
    expected: "Writes .planning/eval/forced-emit-scoreboard-<date>.{json,md}; all native-7 cells are PASS or DOCUMENTED; grep for 'EVAL_SUMMARY forced-emit' shows gated=true per provider; attach artifact to VALIDATION.md"
    why_human: "Live cross-provider keys; localhost-gated by design (D-122-06); secrets + cost + flakiness make this a manual operator gate, not CI"
  - test: "SC#10 cross-provider UAT — for each native-7 provider, send a prompt that triggers execute_code (a forced emission). Observe the workspace panel label."
    expected: "Panel shows a concrete description label (e.g. 'Generating Q3 revenue chart'), never the bare 'execute_code'. Deep turn after is byte-identical. Check all 7 VALIDATION.md UAT rows (UAT-1..7: 4 providers × multi-tool × parallel-thread × long-message)."
    why_human: "Requires rendering the real frontend panel per provider (G-4 lived-experience gate); Chrome MCP is the verification driver"
  - test: "WR-01 follow-up: After the live --forced-emit run, verify the winning_rung column in the scoreboard distinguishes top-rung wins from genuine descents (force_strict providers should show at least one HARD cell with winning_rung != strict_force)"
    expected: "At least one HARD cell for an OpenAI force_strict provider shows winning_rung=non_strict_force or coerce, confirming the recovery rungs actually fired under the HARD schema trip-wire"
    why_human: "The recovery axis in the structure-only test is vacuous (WR-01); the winning_rung field is the real evidence — only visible in the live run artifact"
---

# Phase 122: Cross-Provider Trust & Honesty Parity — Verification Report

**Phase Goal:** Cross-provider emission is recovered-or-honest, doc-verified per provider, measured on a per-provider scoreboard, and task labels are concrete on every provider.
**Verified:** 2026-06-23T09:00:00Z
**Status:** human_needed (4/5 truths verified automatically; SC#3 live operator run + SC#10 live UAT needed)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| SC1 | A strict-400 is recovered by the force→coerce rung ladder in forced_emit (not silent None) | VERIFIED | `_RUNGS_BY_TIER` in forced_emit.py:216-229; `continue` on exception at :466-473; honest `_failure` floor at :507-513; 4/4 descent tests pass |
| SC2 | Each provider's emit_tier is doc-verified: 14 force_strict (OpenAI-only), 36 force, 5 coerce; provider=="openai" gate removed; inert DeepSeek strict removed | VERIFIED | Live registry: 14/36/5=55, 0 non-OpenAI force_strict, deepseek rows emit_tier=force; openai_service.py forcing branch has no provider-name check; fn["strict"]=True loop absent; 7/7 registry + 5/5 gateway tests pass |
| SC3 | The eval treats provider as a first-class axis with a per-provider scoreboard; any emit_tier change is gated on that scoreboard | UNCERTAIN (WARNING) | --forced-emit flag exists; score_forced_emit_axes is a pure function; 11/11 structure-only tests pass; README ritual documented. BUT: no dated scoreboard file in .planning/eval/ — live operator run not yet executed. WR-01: recovery axis = won (cannot distinguish real descent from top-rung win); winning_rung field exists in artifact but is not asserted in structure-only test |
| SC4 | Task labels are concrete on every provider: ungated SYSTEM_PROMPT nudge + deterministic humanize() floor | VERIFIED | agent_loop.py:502-504 carries nudge; humanize() exported in workspacePanel.ts:178; 2/2 backend guard tests + 10/10 frontend label-floor tests pass |
| SC5 | Deep Mode byte-identical; no shared-path fork (D-14 red line) | VERIFIED | 111.1 injection block (forced_emit.py:397-409) untouched; agent_loop.py nudge is one additive string with no logic; test_no_provider_branch_in_shared_path passes in test_gateway_forcing.py |

**Score:** 4/5 truths verified (SC3 is UNCERTAIN — live operator run required)

---

### Deferred Items

None identified.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | emit_tier Literal on ModelCapability + 55-row migration | VERIFIED | emit_tier field on TypedDict; 14 force_strict / 36 force / 5 coerce = 55 rows; all rows have emit_tier key |
| `backend/app/services/openai_service.py` | provider-name gate removed; inert DeepSeek strict removed | VERIFIED | Lines 1535-1572: no fn["strict"]=True loop; no `and provider == "openai"` in forcing branch; commented evidence of removal |
| `backend/app/services/forced_emit.py` | ordered 4-rung recovery ladder; emit_rung telemetry | VERIFIED | _RUNGS_BY_TIER at :216; rung loop at :435; emit_rung in success dict at :499; honest-fail floor at :507 |
| `backend/app/services/agent_loop.py` | single ungated execute_code.description nudge in SYSTEM_PROMPT | VERIFIED | Lines 502-504 contain nudge bullet; no provider-specific logic added |
| `scripts/eval_cross_provider.py` | --forced-emit mode with 4-axis scoring + dated artifact writer | VERIFIED | --forced-emit flag listed in --help; score_forced_emit_axes function; _forced_emit_schemas (EASY+HARD); emit_forced_emit_scoreboard writer |
| `backend/tests/unit/test_config_registry.py` | registry invariant tests (every row has emit_tier; force_strict subset OpenAI; 14/36/5 counts) | VERIFIED | 7/7 tests pass live |
| `backend/tests/unit/test_gateway_forcing.py` | no-provider-gate + deepseek-force + openai-force_strict(A4) tests | VERIFIED | 15/15 tests pass live (includes 3 new Phase 122 tests) |
| `backend/tests/unit/test_forced_emit.py` | rung-descent + tier-scoping + emit_tier-default tests | VERIFIED | 17/17 pass; 4 new descent/scoping/default tests green |
| `backend/tests/unit/test_eval_forced_emit.py` | structure-only scoreboard test (fake gateway, localhost gate, DOCUMENTED-clears-gate) | VERIFIED | 11/11 pass |
| `backend/tests/unit/test_system_prompt.py` | string-presence guard for SYSTEM_PROMPT nudge | VERIFIED | 2/2 pass |
| `frontend/src/lib/workspacePanel.test.ts` | humanize precedence + bare-name floor assertions | VERIFIED | 10/10 pass |
| `.planning/eval/README.md` | forced-emit scoreboard section + operator grep ritual | VERIFIED | "Forced-emit scoreboard" section present with grep-before-tier-flip ritual; D-122-07 DOCUMENTED-clears-gate stated; native-7 gates noted |
| `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` | live operator run artifact (the MP-03 gate evidence) | MISSING (by design) | D-122-06: live keys required; operator-only gate; not automated; must be produced and attached to VALIDATION.md before phase is closed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| emit_tier on MODEL_CAPABILITIES row | forced_emit rung ladder | `cap.get("emit_tier", "coerce")` at forced_emit.py:376 | WIRED | Default-SAFE coerce on registry miss; boundary guard for unknown values at :377-378 |
| forced_emit rung loop | open_stream gateway call | re-drive per rung at :444-464 | WIRED | Each rung builds request via _build_request; continue on exception (descent); never short-circuits |
| emit_tier in config.py | score_forced_emit_axes in eval | direct read of declared_emit_tier param + _rung_order_by_tier mirror at eval:1425-1430 | WIRED | Pure function; mirrors _RUNGS_BY_TIER order; top_rung resolved correctly |
| SYSTEM_PROMPT nudge | execute_code.description tool field | model fills description → tool_args_progress (cross-provider all 3 adapters) → humanize() | WIRED | Schema field already strong (openai_service.py:601-603 untouched); nudge drives model behavior |
| humanize() | workspace panel label | export at workspacePanel.ts:178; workspacePanel.test.ts asserts precedence | WIRED | humanize exported; 10/10 floor tests pass |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| forced_emit.py | emit_tier | MODEL_CAPABILITIES registry via get_model_capability() | Yes — 55 rows populated at import time | FLOWING |
| forced_emit.py | emit_rung (in result dict) | won rung name assigned on success at :499 | Yes — set per real rung execution | FLOWING |
| agent_loop.py SYSTEM_PROMPT | nudge string | literal string at :502-504 | Yes — static config, additive | FLOWING |
| workspacePanel.ts humanize() | description (tool call arg) | model-authored field via tool_args_progress | Yes — model fills on emit; inferLabel(code) floor backstops | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Registry: 55 rows with correct emit_tier split | `backend/venv/Scripts/python.exe -c "from app.config import MODEL_CAPABILITIES; ..."` | 14 force_strict / 36 force / 5 coerce = 55; 0 non-OpenAI force_strict; deepseek=force | PASS |
| Rung ladder descent tests | `pytest test_forced_emit.py -k "ladder or tier_scoped or emit_tier_default"` | 4/4 pass | PASS |
| Gateway forcing: no provider gate + A4 OpenAI preserved | `pytest test_gateway_forcing.py -k "no_provider_gate or deepseek_force or openai_force_strict"` | 5/5 pass | PASS |
| SYSTEM_PROMPT nudge guard | `pytest test_system_prompt.py -x -q` | 2/2 pass | PASS |
| Frontend label floor (humanize precedence + bare-name) | `npx vitest run src/lib/workspacePanel.test.ts` | 10/10 pass | PASS |
| --forced-emit flag in eval script | `scripts/eval_cross_provider.py --help \| grep forced-emit` | "--forced-emit" listed | PASS |
| Eval structure-only (fake gateway, localhost gate) | `pytest test_eval_forced_emit.py -x -q` | 11/11 pass | PASS |
| 111.1 injection block untouched | grep for ollama/lmstudio in forced_emit.py | lines 397-409 present, no +/- diff | PASS |
| Live operator forced-emit run | `scripts/eval_cross_provider.py --forced-emit` (live keys) | NO ARTIFACT — not run yet | SKIP (human gate) |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared for this phase. Operator-run `--forced-emit` eval is the equivalent gate (D-122-06 — manual by design, not a CI probe).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MP-01 | 122-02 | Ordered rung ladder strict→force→coerce→honest-fail in forced_emit | SATISFIED | _RUNGS_BY_TIER + rung loop; 4 descent tests non-vacuous; all 4 consumers inherit unchanged |
| MP-02 | 122-01 | emit_tier enum on every registry row; provider-name gate removed; DeepSeek strict removed | SATISFIED | 55/55 rows have emit_tier; 14/36/5 split confirmed live; gate removal confirmed in source |
| MP-03 | 122-03 | Per-provider scoreboard; operator grep-before-tier-flip ritual | PARTIALLY SATISFIED | Infrastructure complete (eval script, structure tests, README); live artifact not yet produced (human gate) |
| TDP-01 | 122-04 | Ungated SYSTEM_PROMPT nudge + humanize() floor verified | SATISFIED | Nudge at agent_loop.py:502-504; 10/10 frontend floor tests; no provider-specific extraction |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/eval_cross_provider.py` | 1452-1455 | `recovery = "PASS" if won else "FAIL"` — recovery axis equals `won` (WR-01 from code review: cannot distinguish real descent from top-rung win) | WARNING | Scoreboard column does not prove recovery fired; winning_rung field in artifact provides the real evidence. No blocker — the live operator run + winning_rung column is the truth layer (D-122-06). |
| `backend/app/services/forced_emit.py` | 364-370 | Stale docstring: `strict=None` described as honoring `strict_json_schema` registry field (now deprecated-unread) — WR-02 from code review | INFO | Misleading to a future maintainer; behavior is functionally correct (tier/rung-derived). |
| `backend/tests/unit/test_config_registry.py` | 97-101 | Docstring has garbled arithmetic aside ("no —" self-correction mid-sentence) — IN-03 from code review | INFO | Test assertions are correct (14/36/5/55 verified live); prose only. |

No `TBD`, `FIXME`, or `XXX` markers found in any file modified by this phase.

---

### Human Verification Required

#### 1. Live Forced-Emit Scoreboard (MP-03 gate — D-122-06)

**Test:** Run `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --forced-emit` against local Supabase with live native-7 API keys configured.

**Expected:** Writes `.planning/eval/forced-emit-scoreboard-<date>.{json,md}`. All native-7 providers (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, MiniMax) show PASS or DOCUMENTED on all 4 axes. `EVAL_SUMMARY forced-emit` grep shows gated=true. Attach the artifact to VALIDATION.md.

**Why human:** Live cross-provider API keys required; localhost-gated by design; CI use rejected (secrets + cost + flakiness per D-122-06).

#### 2. WR-01 Follow-Up: Recovery Axis Proof via winning_rung

**Test:** After running the live `--forced-emit` scoreboard, inspect the `winning_rung` column in the HARD schema cells. For OpenAI force_strict providers, check if any HARD cell shows `winning_rung=non_strict_force` or `winning_rung=coerce` (confirming the trip-wire fired and the descent happened).

**Expected:** At least one HARD cell for a force_strict or force-tier provider shows `winning_rung` below the tier's declared top rung, proving the recovery rungs genuinely fired (not just top-rung wins on every call).

**Why human:** The `recovery` axis in the structure-only test cannot verify this (WR-01: `recovery = won`). The winning_rung field in the live artifact is the only observable proof that the HARD schema actually triggered a descent.

#### 3. SC#10 Cross-Provider Live UAT (TDP-01 + Deep byte-identical gate)

**Test:** For each native-7 provider, send a prompt that triggers `execute_code`. Observe the workspace panel label. Run all 7 VALIDATION.md UAT rows (UAT-1..7).

**Expected:** Panel shows a concrete description label on every provider (never bare `execute_code`). Multi-tool row (UAT-5): each tool shows its label. Parallel-thread row (UAT-6): both threads recover-or-honest independently. Long-message row (UAT-7): recovery still works. Deep Mode byte-identical.

**Why human:** G-4 lived-experience gate requires real frontend rendering per provider; Chrome MCP drives the verification; screenshot evidence required.

---

### Gaps Summary

No automated blockers. All statically verifiable truths are VERIFIED (4/5 truths). The remaining gap is a human execution gate:

**SC#3 (MP-03) — Live operator run not yet executed.** The `--forced-emit` infrastructure is complete and structure-tested, but the dated scoreboard artifact (the evidence that provider is a first-class axis with measured results) has not been produced. Per D-122-06, this is intentionally a manual gate — the phase is not blocked on code quality, only on the operator running the eval. This is classified as `human_needed`, not `gaps_found`.

**WR-01 (code review warning, not fixed):** The `recovery` axis is technically `== won` in `score_forced_emit_axes`. This means the scoreboard cannot automatically distinguish a genuine rung descent from a top-rung win. The `winning_rung` field in the artifact provides the actual evidence layer. The code review assessed this as a Warning (not a Critical/Blocker). The phase design explicitly places the live operator run as the truth gate (D-122-06); the structure-only test was always scoped to prove writer/scoring/localhost-gate shape, not cross-provider descent reality.

---

_Verified: 2026-06-23T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
