---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 07
subsystem: backend/workflow-authoring
tags: [vocab-02, sc10, cross-provider, roster, integration-test, uat-scoreboard]
requires:
  - "187-02 — the per-phase `name` instruction in AUTHORING_SYSTEM_PROMPT + the server-side name_seeded_by_ai stamp"
  - "app.config.MODEL_CAPABILITIES — the registry the roster is DERIVED from"
  - "generate_workflow_definition's `settings` PARAMETER (workflow_authoring.py:221-231)"
provides:
  - "backend/tests/integration/test_187_authoring_roster.py — the 8-provider SC#10 roster, derived not re-typed"
  - "two ALWAYS-ON registry guards (group count >= 8 incl. deepseek+moonshot; every representative registry-backed)"
  - "the recorded SC#10 scoreboard in 187-VALIDATION.md, every row carrying a verdict"
affects:
  - "187 verification — SC#10 is now measured, not assumed"
  - "the OpenRouter name-drop finding (non-native tool path) — input to any later prompt/backfill decision"
  - "a registry over-claim on the gpt-5.6-* family (forced_emission True, provider refuses function tools)"
tech-stack:
  added: []
  patterns:
    - "derive the roster by importing + grouping the registry; a hand-typed id list is an acceptance failure"
    - "per-row settings STUB instead of a global monkeypatch — settings is a parameter, so rows are independent"
    - "record-then-skip: a blocked row writes its verdict + machine-readable code BEFORE pytest.skip"
    - "module-scoped finalizer always emits the FULL board, including rows never reached"
key-files:
  created:
    - backend/tests/integration/test_187_authoring_roster.py
  modified:
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md
decisions:
  - "The skipif is applied PER-ROW inside the test, not module-level, so the two registry guards run in the default suite"
  - "No row is xfail-ed — a predicted failure recorded as a finding beats a green suite that hides it"
  - "The openai ❌ is recorded as an endpoint/registry defect, not a name failure, and evidenced with a supplementary gpt-5.5 diagnostic"
  - "The openrouter assertion was NOT weakened despite the failure reproducing only 1 of 2 samples"
metrics:
  duration: ~65 min (incl. 718 s of live provider calls + a 2-row re-sample)
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 07: The SC#10 provider roster — Summary

Eight real workflow generations, one per provider group, each asserting that every phase of the
emitted definition carries a non-empty `name` — and the board is recorded honestly: **5 ✅, 3 ❌,
0 ⛔**, with the one genuine VOCAB-02 failure isolated from the two that are about something else.

## What Was Built

**Task 1 — the derived roster (`9f530082`).** `backend/tests/integration/test_187_authoring_roster.py`
imports `MODEL_CAPABILITIES`, groups on `provider`, and picks one representative per group with a
documented ordering heuristic: the largest version tuple parsed out of the id's last path segment,
ties breaking on `llm_call_timeout_seconds` → `max_output_tokens` → id. **Measured 2026-08-02: the
heuristic needs no override map at all** — it independently selects the newest flagship in all eight
groups, so the file contains zero hand-typed model ids. Each row passes its own
`SimpleNamespace(harness_authoring_model=<id>)`; `grep -c monkeypatch` returns **0**.

Two guards run in the **default suite** (no key, no network, no Supabase): the group count is ≥ 8 and
includes `deepseek` + `moonshot`, and every representative round-trips through the shipping
`get_model_capability` lookup as `capability_source="registry"` — which also pins the case-sensitive
`MiniMax`-style capitalisation, the known registry-miss trap that silently degrades a row to
`inferred` and drops its `emit_tier`.

**Task 2 — the live run + the recorded board (`847f2374`).** All 8 rows executed live against the
local Supabase in 718 s. The scoreboard, both SPEC refutations, the three ❌ analyses and the M7
carve-out are appended to `187-VALIDATION.md` as a pure insert (89 lines added, **0 deleted** — the
measured-baseline table and the Manual-Only table are untouched).

## The Measured Scoreboard (2026-08-02)

| Provider | Model (derived) | `emit_tier` | Verdict | One-line evidence |
|---|---|---|---|---|
| anthropic | `claude-sonnet-5` | force | ✅ | 4 phases, all named + stamped |
| deepseek | `deepseek-v4-pro` | force | ✅ | 5 phases, all named |
| google | `gemini-3.5-flash` | force | ✅ | 3 phases, all named |
| minimax | `MiniMax-M3` | force | ❌ | never emits — 4 × HTTP 200, no tool call |
| moonshot | `kimi-k2.6` | **coerce** | ✅ | the predicted-risky row **passed**, 5/5 named |
| openai | `gpt-5.6-sol` | force_strict | ❌ | provider 400: function tools + `reasoning_effort` unsupported on `/v1/chat/completions` |
| openrouter | `z-ai/glm-5.2` | force (**non-native**) | ❌ | **5/5 phases unnamed on 1 of 2 samples** |
| zhipu | `glm-5.2` | force | ✅ | 5 phases, all named |

**Zero ⛔ rows** — all eight provider keys were configured, so nothing was blocked and nothing was
omitted. Derived group count **8**, across **61** registry models.

## Findings (the reason this plan exists)

1. **OpenRouter drops the per-step names — non-deterministically.** Sample 1 returned a fully valid
   `WorkflowDefinition` whose five phases all carried empty `name`s; sample 2, same prompt, named all
   five. OpenRouter rows are `native_tools: False` — the non-native tool path, where a prompt-level
   instruction is weakest. **The assertion was not weakened.** Graceful-degradation context: Req 1's
   derived node-face ladder is exactly the fallback for a missing `name`, so the canvas shows a
   config-derived face rather than a blank one.
2. **`MODEL_CAPABILITIES` over-claims for the whole `gpt-5.6-*` family.** The registry marks
   `gpt-5.6-sol` `forced_emission: True` / `emit_tier: force_strict`, but OpenAI now refuses function
   tools for reasoning-first models on `/v1/chat/completions` outright — verbatim, captured directly
   from the API: *"Function tools with reasoning_effort are not supported for gpt-5.6-sol in
   /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."*
   The forced-emit ladder descends to a non-forced rung, gets a 200, and emits nothing. A candidate
   registry/gateway fix, adjacent to `BUG-260731-01` — deliberately **not** attempted here (it is a
   Rule-4 architectural change outside this plan's two files).
3. **OpenAI's real SC#10 answer is green.** A supplementary diagnostic — *not* a roster row, so the
   roster stays derived — ran the same describe prompt through `gpt-5.5`, one of the two ids
   `resolve_authoring_model`'s **fallback** branch picks (i.e. the model an OpenAI generation actually
   uses when the knob is unset): **5 phases, every one named and stamped.** So the openai ❌ belongs
   to the model id, not to the instruction.
4. **`MiniMax-M3` never emits.** Two samples: a 240 s ceiling expiry, then at the registry's own 600 s
   ceiling four HTTP 200s across two attempts with no tool call in any of them. Nothing was measured
   about names because nothing was emitted. Incidental live confirmation of 187-02's budget contract:
   exactly **two** `nl_generation_attempt` events, never a third, on the all-fail path.
5. **The moonshot prediction did not hold, and that is recorded too.** `resolve_authoring_model`'s
   branch 1 still returns an explicitly-set model without validating `forced_emission` — a real
   property of the knob — but the coerce-tier `kimi-k2.6` named all five phases anyway. No row was
   `xfail`-ed, so neither the prediction nor its refutation is hidden.

## SPEC Refutations, Re-measured 2026-08-02

Per the standing "don't inherit unmeasured claims" rule, every figure was re-derived at execution
time rather than copied from the SPEC:

| Claim | Status | Measured |
|---|---|---|
| DeepSeek absent from the registry | **REFUTED** | `deepseek-v4-flash` + `deepseek-v4-pro`, both `force`. The shape test now pins the group key. |
| N models lack `forced_emission` | **CORRECTED** | Exactly **5**: three moonshot natives + two OpenRouter moonshot rows, all `coerce`. |
| Rows must drive an app setting → run serially with global mutation | **SUPERSEDED** | `settings` is a plain parameter; rows are independent and mutate nothing. |
| 8 provider groups / all keys configured | **CONFIRMED** | 8 groups, 61 models, 8/8 keys present ⇒ 0 ⛔. |

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] The skip gate is per-row, not module-level.**
The plan asked for `pytestmark = pytest.mark.skipif(...)` at module scope. That would also skip
`test_roster_is_derived_from_the_live_registry`, which is the stated mitigation for T-187-07-02
(roster completeness) and needs no key, no network and no Supabase. A completeness guard that only
runs under an opt-in cannot catch the registry edit it exists to catch. The gate is therefore applied
inside the live test, which *additionally* satisfies the plan's own "record, never omit" requirement —
a collection-time skip mark cannot write a ⛔ row, whereas `_block()` records the verdict and a
machine-readable code **before** skipping. The plan's intent is fully preserved: `pytest tests/ -q`
collects the 8 rows, skips them all with `[opt-in] …`, and makes zero provider calls (verified).
The reasoning is written into the file's docblock so the choice is not silently re-litigated.

**2. [Rule 1 — bug] The scoreboard echo crashed teardown on a Windows console.**
The module finalizer printed the board containing ✅ / ❌ / ⛔ to a cp1252 stdout, raising
`UnicodeEncodeError` in teardown — pytest reported it as an ERROR on the last row, i.e. the echo
corrupted the very board it was printing. The UTF-8 **file** artifact was already written and was
fine. Fixed by re-encoding the banner with `errors="replace"` against `sys.stdout.encoding`.
Fixed in the Task-2 commit (the file is in Task 2's `<files>` list); verified clean.

**3. Two supplementary measurements beyond the plan's letter, both recorded as such.**
(a) The two ❌ rows most likely to be misread were re-sampled — minimax at its registry's own 600 s
ceiling (to separate "slow" from "broken"), openrouter a second time (to separate "always drops
names" from "sometimes drops names"). The second openrouter sample is what turned a wrong, stronger
claim into the correct, weaker one. (b) The `gpt-5.5` diagnostic isolates the openai ❌ as an endpoint
defect rather than a name failure. Neither touched the roster derivation, and both are labelled in
`187-VALIDATION.md` as supplementary, not as roster rows.

**No assertion was weakened, and no row was `xfail`-ed.**

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-07-01 (Info disclosure — provider keys) | mitigated | Keys are touched only inside `bool(getattr(settings, f"{provider}_api_key", ""))`. The board records presence as a boolean; no key value is logged, printed or written. |
| T-187-07-02 (Tampering — roster completeness) | mitigated, **strengthened** | Derived by import + group, zero hand-typed ids (`grep -cE` on the eight literals → **0**). The two guards run in the DEFAULT suite, not behind the opt-in — a shrunken registry fails CI, not just an opt-in run. Blocked rows are recorded ⛔ with a code; 0 blocked this run. |
| T-187-07-03 (DoS — the default suite) | mitigated | `pytest tests/ -q` → 8 rows skipped, 2 guards pass, 0.30 s, no network. Collection 3523 → **3533** (+10, nothing replaced). Live rows additionally carry a wall-clock ceiling (`ROSTER_187_TIMEOUT`, default 300 s) so a hung provider cannot wedge a run. |
| T-187-07-04 (Tampering — global settings) | mitigated | `grep -c monkeypatch` → **0**. Each row passes its own stub; the operator's environment and `app_settings` were not written by any row. |
| T-187-07-05 (V5 — emitted definition) | mitigated | Every ✅ row round-tripped `WorkflowDefinition.model_validate()` — the `extra="forbid"` discriminated union is the gate. |

## Known Stubs

None. The one deliberate gap is scoped and named: manual row **M7** (the `HARNESS_AUTHORING_MODEL`
env path reaching `resolve_authoring_model` in a running backend) is not automatable without a
restart and stays in the Manual-Only table, called out explicitly in the recorded section.

## Notes for Later Plans

- **The OpenRouter name drop is intermittent, not systematic.** Any later decision (prompt hardening,
  a server-side name backfill) should treat it as a reliability problem on the non-native path, and
  should re-sample rather than trust a single generation. `RUN_187_AUTHORING_ROSTER=1 pytest
  tests/integration/test_187_authoring_roster.py -k openrouter` is a one-command re-sample.
- **Do not "fix" the openai row by editing the roster.** The heuristic correctly picks the newest
  registry-backed id; the red is the registry's `forced_emission: True` claim for a family the
  provider will not force. Fixing it means changing `MODEL_CAPABILITIES` or the gateway's
  `reasoning_effort` handling — a separate, architectural change.
- **The board is re-runnable and self-recording.** Every run writes the full 8-row table to
  `ROSTER_187_OUT` (default `<tmp>/phase187_roster_scoreboard.md`), including rows never reached, so
  a partial `-k` run cannot produce a board that looks complete.

## Verification

```
pytest tests/integration/test_187_authoring_roster.py --collect-only -q  → 10 items (8 rows + 2 guards)
pytest tests/integration/test_187_authoring_roster.py -q                 → 2 passed, 8 skipped, 0.30 s
pytest tests/ -q --collect-only                                          → 3533 (was 3523; +10 net-new)
grep -c monkeypatch …/test_187_authoring_roster.py                       → 0
grep -cE '"(the eight roster ids)"' …/test_187_authoring_roster.py        → 0
git diff --numstat -- …/187-VALIDATION.md                                 → 89 insertions, 0 deletions
grep -c "⛔\|✅\|❌" …/187-VALIDATION.md                                    → 45
LIVE: RUN_187_AUTHORING_ROSTER=1 pytest …                                → 8/8 rows executed, 718 s
```

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | `9f530082` | `test(187-07): derive the SC#10 provider roster from MODEL_CAPABILITIES` |
| 2 | `847f2374` | `docs(187-07): record the live SC#10 roster scoreboard — 5 pass / 3 fail, 0 blocked` |

## Self-Check: PASSED

Both claimed files exist on disk; the modified `187-VALIDATION.md` exists and carries the new
section; both claimed commits resolve in `git log`.
