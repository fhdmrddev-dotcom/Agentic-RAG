---
phase: 188-non-technical-run-observability
plan: 11
subsystem: verification-tooling
tags: [sc10, cross-provider, uat, scoreboard, workflow-runs]
requires:
  - app.config.MODEL_CAPABILITIES
  - app.models.user_settings.override_provider
  - app.services.sub_agent_models.resolve_workflow_ctx_model
  - scripts/conc_probe.py (five-piece plumbing kit)
  - frontend/src/lib/phaseState.ts (the derivation this board mirrors)
provides:
  - scripts/sc10_188_run_board.py (roster derivation + key probe + 8 kickoffs + DB verdict reads)
  - .planning/phases/188-non-technical-run-observability/188-UAT.md (the authored board)
affects:
  - 188-13 (the operator gate that RUNS these rows)
tech-stack:
  added: []
  patterns:
    - "reuse conc_probe.py's five-piece kit by import (load_env -> assert_localhost_only FIRST -> report_env_presence -> get_bearer_token -> connect_db), as longmsg_workflow_smoke.py does"
    - "constant-string allowlisted SQL, %s params only"
    - "derive rosters by EXECUTING the registry, never by transcribing it"
key-files:
  created:
    - scripts/sc10_188_run_board.py
    - .planning/phases/188-non-technical-run-observability/188-UAT.md
  modified: []
decisions:
  - "D-188-24 honoured by execution: the roster is grouped out of MODEL_CAPABILITIES at run time (61 models -> 8 groups); no provider-name literal appears in the script"
  - "The version tie-break is LAST-DECLARED within a family, and every tied id is printed — the choice is auditable rather than silent"
  - "The key probe calls override_provider itself rather than guessing env-var names — the pre-flight EXECUTES the production path whose no-op is the trap"
  - "PASS requires status == 'completed', not merely a terminal status: a failed run means the provider row did not actually run the workflow"
metrics:
  duration: ~55m
  completed: 2026-08-05
  tasks: 2
  files: 2
---

# Phase 188 Plan 11: SC#10 Cross-Provider Board Summary

Authored the SC#10 scoreboard and its driver — the roster derives itself from
`MODEL_CAPABILITIES` at run time, API-key availability is probed by calling the very
function whose silent no-op is the trap, and every verdict is read back from the database
so a row that did not really run cannot read as a pass.

## What Was Built

**`scripts/sc10_188_run_board.py`** (628 lines) — three jobs, in this order:

1. **Roster derivation (D-188-24).** Groups `app.config.MODEL_CAPABILITIES` by `provider`
   and takes the newest **registry-backed** id per group. Nothing is transcribed: there is
   no provider-name literal anywhere in the file, so a ninth provider appears on the board
   the day it is added to the registry rather than the day someone remembers to retype the
   table. The version key drops the vendor prefix first (`z-ai/glm-5.2` → `glm-5.2`) so
   the version comes from the model, not from whoever resells it, and flattens every
   numeric run — which is why `claude-sonnet-5` → `(5,)` correctly outranks
   `claude-opus-4-8` → `(4, 8)`. Ties (`gpt-5.6-sol/-terra/-luna`,
   `deepseek-v4-flash/-pro`) are broken by last-declared **and every tied id is printed**,
   so the judgement is auditable rather than hidden. `capability_source` and `emit_tier`
   are printed per chosen id, so a row that would measure an `inferred` configuration
   (which silently loses `emit_tier`) is visible.

2. **Key probe, before any kickoff.** It does not guess env-var names — it calls
   `override_provider(settings, pid)` and checks whether `active_provider` actually
   changed, which is precisely the silent no-op described in trap 2, then calls
   `resolve_workflow_ctx_model` on the result. The pre-flight is therefore an **execution**
   of steps 4→8 of the traced chain, not a model of it. Presence only: no key value,
   prefix or length is ever printed (T-188-11-03).

3. **Drive + DB verdict.** One row per provider with a per-request `provider` on
   `POST /threads/{id}/messages` — no global setting is mutated (T-188-11-02). Then the
   **effective** provider/model is read back from the sub-agent `runs` rows
   (`parent_run_id = producer`), the terminal `workflow_runs.status` is read, and each
   `workflow_phases.status` is mapped through a mirror of the shipped
   `frontend/src/lib/phaseState.ts` derivation. Every derived provider gets a table row
   whatever happened to it (T-188-11-04).

**`188-UAT.md`** — the board itself: the 8-row cross-provider table with the roster and
key-probe output pasted verbatim, the three other axes (multi-tool, parallel-thread,
long-message), the six G-4 lived-experience rows, and a header block carrying the three
measured constraints so no row is authored on a false premise. **Every result cell is
`[pending]`.** No row is marked PASS by the plan that wrote it.

## The Three Traps, Handled Rather Than Absorbed

All three were **inherited** from `188-RESEARCH.md § Open Question 1` and then
**re-confirmed live** by the pre-flight, which is worth stating because two of them are
now backed by a measurement rather than a code trace:

| Trap | How the board handles it | Live confirmation |
|---|---|---|
| Per-request `model` does not reach a harness phase; `provider` does | The board records the **effective** model read from `runs`, and the method note says plainly that this measures the **provider axis, not the model axis** | The `google` row requests `gemini-3.5-flash`; the predicted effective model is `gemini-3.6-flash` — the saved `llm_model`. The requested id genuinely does not arrive |
| `override_provider` fails silently without a key | Probed before driving **and** read back after; a requested-vs-effective mismatch is ⛔ `SC10-188-MISROUTE`, never a pass | All 8 providers had a key on 2026-08-05, so no row is keyless *today* — the probe is re-run at gate time precisely because that can change |
| `phase.config.model` beats everything | The driver **refuses to run** against a fixture that pins a per-phase model, naming the reason. `research_summarize` was checked: no pin | OpenRouter's `_SUB_AGENT_MODEL_DEFAULTS` entry is `""` and it is a flexible provider, so the predicted effective model for that row is `gemini-3.6-flash` — unslashed, a predicted 404. The row carries that as its pre-stated ⛔ reason with the `--openrouter-definition-slug` escape |

## Verification

`cd backend && ./venv/Scripts/python.exe ../scripts/sc10_188_run_board.py --derive-only`
— **raw output**, 2026-08-05:

```
SC10_ROSTER groups=8 (derived by executing MODEL_CAPABILITIES)
SC10_ROSTER provider=anthropic newest=claude-sonnet-5 capability_source=registry emit_tier=force native_tools=True ids_in_group=7 registry_backed=7
SC10_ROSTER provider=deepseek newest=deepseek-v4-pro capability_source=registry emit_tier=force native_tools=True ids_in_group=2 registry_backed=2 tied_with=['deepseek-v4-flash', 'deepseek-v4-pro']
SC10_ROSTER provider=google newest=gemini-3.5-flash capability_source=registry emit_tier=force native_tools=True ids_in_group=7 registry_backed=7
SC10_ROSTER provider=minimax newest=MiniMax-M3 capability_source=registry emit_tier=force native_tools=True ids_in_group=8 registry_backed=8
SC10_ROSTER provider=moonshot newest=kimi-k2.6 capability_source=registry emit_tier=coerce native_tools=True ids_in_group=3 registry_backed=3
SC10_ROSTER provider=openai newest=gpt-5.6-luna capability_source=registry emit_tier=force_strict native_tools=True ids_in_group=17 registry_backed=17 tied_with=['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']
SC10_ROSTER provider=openrouter newest=z-ai/glm-5.2 capability_source=registry emit_tier=force native_tools=False ids_in_group=9 registry_backed=9
SC10_ROSTER provider=zhipu newest=glm-5.2 capability_source=registry emit_tier=force native_tools=True ids_in_group=8 registry_backed=8

SC10_KEY settings_source=app_settings (async, DB-backed)
SC10_KEY baseline active_provider=google saved_llm_model='gemini-3.6-flash' (⚠ the saved llm_model — NOT any --model you pass — is what reaches a phase)
SC10_KEY provider=anthropic api_key=present request_model=claude-haiku-4-5-20251001 predicted_effective_model=claude-haiku-4-5-20251001
SC10_KEY provider=deepseek api_key=present request_model=deepseek-v4-flash predicted_effective_model=deepseek-v4-flash
SC10_KEY provider=google api_key=present request_model=gemini-3.5-flash predicted_effective_model=gemini-3.6-flash
SC10_KEY provider=minimax api_key=present request_model=MiniMax-M2.7-highspeed predicted_effective_model=MiniMax-M2.7-highspeed
SC10_KEY provider=moonshot api_key=present request_model=kimi-k2.6 predicted_effective_model=kimi-k2.6
SC10_KEY provider=openai api_key=present request_model=gpt-5.4-mini predicted_effective_model=gpt-5.4-mini
SC10_KEY provider=openrouter api_key=present request_model=z-ai/glm-5.2 predicted_effective_model=gemini-3.6-flash ⚠ _SUB_AGENT_MODEL_DEFAULTS['openrouter'] is empty and 'openrouter' is a flexible provider — the saved llm_model passes through UNSLASHED (predicted 404); pin phase.config.model via --openrouter-definition-slug to drive it
SC10_KEY provider=zhipu api_key=present request_model=glm-5-turbo predicted_effective_model=glm-5-turbo

SC10_RESULT DERIVE-ONLY — roster + key probe printed; no row driven.
```

(`sub_agent_models` also emits its own cross-provider-guard WARNINGs to stderr during the
probe — those are the guard firing correctly, and they are useful evidence, so they are
left unsuppressed.)

Acceptance criteria, measured:

| Criterion | Result |
|---|---|
| `--derive-only` prints exactly 8 provider groups with newest registry-backed id + `capability_source` | ✅ `groups=8`, all 8 `capability_source=registry` |
| `grep -c 'MODEL_CAPABILITIES' scripts/sc10_188_run_board.py` ≥ 1 | ✅ 9 |
| No hard-coded provider-name list (`"anthropic"` alongside `"minimax"`) | ✅ no match |
| Key probe runs before any kickoff | ✅ `probe_keys` is called before the drive loop; `--derive-only` returns before the loop entirely |
| Reads `runs.provider` back and marks a mismatch ⛔ | ✅ `SC10-188-MISROUTE` |
| Emitted table has one row per derived provider regardless of outcome | ✅ undriven / keyless providers emit `_blocked_row` |
| `188-UAT.md` has exactly 8 provider rows | ✅ 8 |
| Multi-tool + parallel-thread + long-message rows present | ✅ rows 9, 10, 11 |
| The six G-4 / manual rows present with steps + decisive observable | ✅ rows 12-17 |
| ⛔ vocabulary present and usable | ✅ 9 occurrences, plus a blocking-id glossary |
| No row marked PASS by this plan | ✅ 0 |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ 0 files |
| No frontend or backend application source modified | ✅ only `scripts/` + `.planning/` |
| `node scripts/vitest-count-gate.cjs` | ✅ `count gate OK — 26/26 pinned files present, no per-file decrease, 0 failing` (total 2421, **failed 0**) |

## Deviations from Plan

**None affecting scope.** Two judgements the plan left open were made and are recorded
here so they can be challenged rather than discovered:

1. **Tie-break rule.** The plan said "newest registry-backed id per group" without saying
   how to break a version tie. Chosen: last-declared within the tied family, since the
   registry appends newer members beneath their siblings. This reproduces RESEARCH's
   `deepseek-v4-pro`; for OpenAI it yields `gpt-5.6-luna`, where RESEARCH listed all three
   `gpt-5.6-*` ids without committing. Every tied id is printed so the reader sees the tie
   rather than a bare answer. It is also immaterial to the measurement: the *effective*
   model is `_SUB_AGENT_MODEL_DEFAULTS[provider]` regardless (trap 1).

2. **The OpenRouter row is DRIVEN by default, not pre-⛔'d.** The plan permitted either a
   pinned fixture or an up-front ⛔. Pre-marking a row that was never driven would assert a
   prediction as a measurement, so the driver drives it and records what actually happened;
   the predicted 404 is printed as a WARN in the pre-flight and carried as the row's
   pre-stated reason in `188-UAT.md`. `--openrouter-definition-slug` is the opt-in for a
   fixture pinning a registry-backed OpenRouter id, if the operator seeds one. No fixture
   was seeded here — that would be a DB write this plan does not need.

## Notes for the Operator Gate (188-13)

- **Re-run the key probe at gate time.** All eight providers had keys on 2026-08-05. A key
  that disappears between now and then turns a ⛔ into a false PASS — that is the entire
  reason the probe exists.
- **Row 13 (`skip_to_phase`) has no seeded fixture.** Measured: **0** rows in
  `workflow_definitions` contain `skip_to_phase`. The row's steps say to author one; it is
  the highest-value observation on the board because it is the *reachable* fail-open.
- **A `failed` terminal status is ⛔ `SC10-188-RUN`, not a PASS.** A terminal state alone
  is not enough — a failed run means that provider row did not actually run the workflow.
- The fixture must keep an `llm_agent` phase. Only `run_task_sub_agent` was traced to
  `insert_run`, so an all-`llm_single` fixture leaves the *Effective* column unreadable and
  every row becomes ⛔ `SC10-188-NOEVIDENCE`.

## Threat Flags

None. This plan adds no network endpoint, no auth path and no schema change. The one new
file is a localhost-hard-gated operator script that mutates no global setting and prints
no secret.

## Self-Check: PASSED

- `scripts/sc10_188_run_board.py` — FOUND
- `.planning/phases/188-non-technical-run-observability/188-UAT.md` — FOUND
- commit `a722ff0e` — FOUND
- commit `542a24d9` — FOUND
- `supabase/migrations/` diff — 0 files
