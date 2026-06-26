---
phase: 129
slug: minimax-openrouter-arg-repair
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 129 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `129-RESEARCH.md` §"Validation Architecture". Backend-only phase; the
> load-bearing validation is the SC#10 4-axis cross-provider live scoreboard (manual),
> backstopped by mockable unit coverage of the MiniMax arg-repair / re-ask path.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend `venv`) |
| **Config file** | `backend/pytest.ini` / `backend/pyproject.toml` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -k "openai_service or minimax or openrouter or arg_repair" -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | quick ~10–30s · full per backend baseline (known partial rot — prove net-new via baseline) |

---

## Sampling Rate

- **After every task commit:** quick run (scoped `-k`)
- **After every plan wave:** full suite
- **Before `/gsd:verify-work`:** scoped suite green + the SC#10 scoreboard run live
- **Max feedback latency:** ~30 seconds (scoped)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| P02-T1 — MiniMax-gated arg-validity guard + bounded re-ask + recovered/honest-fail | 02 | 1 | MP-04 | T-129-04, T-129-05, T-129-06 | invalid MiniMax tool-args detected before round-trip append; one bounded corrective-nudge re-ask; recovered `tool_args_recovered` signal OR honest `bad_request` copy; never silent swallow / partial dispatch | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py -x -q` | ✅ `backend/tests/test_129_minimax_argrepair.py` (8 passed) | ✅ green |
| P02-T1 — re-ask is bounded (cap=1) on its own run-scoped counter | 02 | 1 | MP-04 | T-129-04, T-129-07 | `_minimax_argrepair_retries` is a separate single-shot counter (NOT `_provider_retries`); cannot burn or be burned by the transient-error budget | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py::test_reask_bounded_separate_counter -x` | ✅ same file | ✅ green |
| P02-T1 — guard is a no-op for non-MiniMax (D-14 RED LINE) | 02 | 1 | MP-04 | T-129-08 | for openai/anthropic/google the decision is always `ok`; `messages.append` round-trip byte-identical to pre-129 | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py::test_non_minimax_unaffected -x` | ✅ same file (parametrized 3 providers) | ✅ green |
| P02-T1 — still-malformed re-ask → honest `bad_request`, no leak | 02 | 1 | MP-04 | T-129-05, T-129-06 | honest-fail surfaces the fixed `bad_request` copy; no `tool_call_id` / json-string leak; no brace-balancing | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py::test_still_malformed_honest_fail -x` | ✅ same file | ✅ green |
| P02-T1 — successful re-ask emits the quiet recovered signal | 02 | 1 | MP-04 | T-129-07 | one `tool_args_recovered` via Deep-side `_emit` on `run:{run_id}` (not the harness `forced_emit`/`_emit_audit` substrate) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py::test_recovered_signal_emitted -x` | ✅ same file | ✅ green |
| P01-T1 — OpenRouter `require_parameters` injected quality-only | 01 | 1 | MP-04 | T-129-08 | `extra_body["provider"]={"require_parameters":True}` ONLY on `quality` + `provider=="openrouter"`; ABSENT on native/xml and on non-OpenRouter providers (shared-path safe) | unit | `cd backend && venv/Scripts/python -m pytest tests/test_129_openrouter_require_params.py -x -q` | ✅ `backend/tests/test_129_openrouter_require_params.py` (4 passed) | ✅ green |

*The truncation-detection + one-shot re-ask (D-01) and the OpenRouter `require_parameters` injection (D-02) are unit-mockable and GREEN (Wave 1 — Plans 01/02). They are the automated backstop. The recovered/honest-fail honesty signal, the OpenRouter routing before/after, and the cross-provider no-regression proof are observable only LIVE — the SC#10 4-axis scoreboard below is the LOAD-BEARING gate (per CLAUDE.md SC#10 recipe + T-129-09: a mocked-only sign-off must NOT false-green a live cross-provider streaming defect).*

---

## Wave 0 Requirements

- [ ] `backend/tests/` test file(s) for the MiniMax arg-repair / one-shot re-ask path (mock the OpenAI-compat client to return a truncated tool-args 400, assert exactly one re-ask then honest-fail; assert a successful re-ask emits the recovered signal)
- [ ] Unit assertion that `require_parameters` lands in the OpenRouter `extra_body` under `provider` ONLY on the `quality` strategy, and is ABSENT for non-OpenRouter providers (shared-path safety)

*If existing `openai_service` tests already provide fixtures, extend them rather than re-scaffold.*

---

## Manual-Only Verifications (SC#10 4-axis cross-provider scoreboard — LOAD-BEARING)

> This is the phase gate. The Wave-1 unit suites (`test_129_minimax_argrepair.py` 8 passed,
> `test_129_openrouter_require_params.py` 4 passed) are the automated backstop; they pin the
> request-build + decision-ladder SHAPE. Only a LIVE run proves the ladder recovers-or-honest-fails
> on real truncating traffic, that OpenRouter `require_parameters` improves schema-honoring with no
> `:exacto`/`plugins` routing regression, and that OpenAI/Anthropic/Google stay byte-identical
> (the D-14 RED LINE). `nyquist_compliant` flips ONLY after every row below records PASS.

### Pre-flight (assistant does these before driving rows)

1. Confirm backend uvicorn is running — ask the operator to start it in their visible terminal if not (never `run_in_background`).
2. Confirm the app is reachable at http://localhost:5173/ (login `fhdmrd@gmail.com` / `123456`).
3. Have the Supabase cross-check query ready (psycopg2 / `psql` at `localhost:54322`, this is how run `2c711ee4` was confirmed) — per run, read `status`, `output_tokens`, `error`, `model`, `provider` from `runs`; read tool-call rows from `messages`.
4. The recovered signal `tool_args_recovered` is a Redis Stream XADD on `run:{run_id}` (Deep-side `_emit`) — observe it in the backend uvicorn console log line for that run_id, or by inspecting the run's event buffer; it carries NO `delta`/`error`, so the UI shows nothing user-facing (by design).
5. The honest-fail copy to look for verbatim (from `message_for_kind("bad_request")`): **"Model parameter error — this model may not support the current configuration."**

### The scoreboard (operator runs one row at a time; assistant cross-checks the DB after each)

Legend — **Axes:** XP = cross-provider · MT = multi-tool · PT = parallel-thread · LM = long-message (≥5 KB code payload — the MiniMax-M3 output-token-cap reproduction).

| # | Axis(es) | Provider / Model | Prompt shape (operator sends) | Expected observable (the PASS condition) | Evidence source | Result / Outcome |
|---|----------|------------------|-------------------------------|------------------------------------------|-----------------|------------------|
| R1 | XP (regression) | **OpenAI** (e.g. gpt-5.x) | A normal tool-using prompt — `search_documents` for a known doc, then a short `execute_code` (e.g. compute a sum). | Tool calls round-trip and the run **completes**. **NO `tool_args_recovered` event** anywhere. Round-trip is byte-identical to pre-129 (the MiniMax guard never fires off the MiniMax path). **D-14 RED LINE.** | Supabase `runs`: status=`succeeded`, no error. Backend log: no `tool_args_recovered` for this run_id. | _(operator fills — PASS/FAIL + evidence)_ |
| R2 | XP (regression) | **Anthropic** (e.g. claude-x) | Same normal tool-using prompt as R1. | Same as R1: completes, **no `tool_args_recovered` event**, byte-identical round-trip. **D-14 RED LINE.** | Supabase `runs` succeeded; no recovered event in log. | _(operator fills)_ |
| R3 | XP (regression) | **Google** (e.g. gemini-x) | Same normal tool-using prompt as R1. | Same as R1: completes, **no `tool_args_recovered` event**, byte-identical round-trip. **D-14 RED LINE.** | Supabase `runs` succeeded; no recovered event in log. | _(operator fills)_ |
| R4 | XP + LM (**MiniMax RECOVERED rung**) | **MiniMax-M3** (provider=minimax) | A **heavy `execute_code` prompt** that forces a large tool-args payload — ask the agent to write a ≥5 KB script (e.g. "generate a fully-commented 200-line data-pipeline that builds a pandas DataFrame, plots 6 seaborn charts, and writes a report"). This is the reproduction class of run `2c711ee4` (`output_tokens=8192` cap). | The run does **NOT** 400-die. **Exactly one `tool_args_recovered` event** on `run:{run_id}` (the corrective-nudge re-ask succeeded), then the run **continues**. If MiniMax doesn't truncate on the first attempt, escalate the requested payload size until `output_tokens` approaches the ~8192 cap. | Supabase `runs`: model=`MiniMax-M3`, the run progresses past the truncated turn (not status=`failed` with the args error). Backend log: one `tool_args_recovered` for this run_id. | _(operator fills)_ |
| R5 | XP + LM (**MiniMax HONEST-FAIL rung**) | **MiniMax-M3** (provider=minimax) | Drive a prompt where the **re-ask still truncates** — push the payload even larger than R4 (or repeat the heaviest R4 prompt until the single re-ask also caps out). Goal: exhaust the cap=1 re-ask. | The honest-fail copy **"Model parameter error — this model may not support the current configuration."** is surfaced to the user, the run **fails cleanly**, and there is **NO silent swallow and NO partial/fabricated tool dispatch** (no brace-balanced args, no half-run tool). | Supabase `runs`: status=`failed`. `messages`: NO synthesized/partial tool_call result for the bad turn. UI shows the bad_request copy verbatim. Backend log: re-ask counter hit cap=1 then honest-fail. | _(operator fills)_ |
| R6 | MT (**MiniMax multi-tool**) | **MiniMax-M3** (provider=minimax) | A single prompt exercising **2+ tools**, e.g. `search_documents` (find a doc) **and** `execute_code` (process its content) in one turn. | Each `tool_call` is validated **independently** — the per-tool-call guard fires only on a malformed one and lets valid ones through; a valid `search_documents` is not blocked by a malformed `execute_code` (or vice-versa). Run completes (or recovers/honest-fails on the malformed call only). | Supabase `messages`: both tool calls present; only the malformed one (if any) diverts. Backend log: guard decision per tool_call. | _(operator fills)_ |
| R7 | PT (**parallel-thread isolation**) | **MiniMax-M3** (Thread A) + any provider (Thread B) | Start **Thread A** with the R4 heavy `execute_code` prompt (triggering the repair ladder). **While A is still streaming**, switch to **Thread B** and submit a new prompt. | The re-ask counter + the `tool_args_recovered` signal stay **scoped to Thread A's run_id only** — **no cross-thread bleed** into Thread B (T-129-07). Thread B runs independently and shows no `tool_args_recovered`. | Supabase: A's run_id carries the recovered event; B's run_id does not. Backend log: recovered `_emit` targets `run:{A_run_id}` only; confirm the `run:{run_id}` keyspace scoping. | _(operator fills)_ |
| R8 | XP (**OpenRouter BEFORE — baseline**) | **OpenRouter** quality model | On `openrouter_tool_strategy` set to a **non-quality** strategy (`native` or `xml` — `require_parameters` ABSENT), run a tool-using prompt. Note tool-schema honoring as the baseline. | Routing **succeeds** with `require_parameters` ABSENT (baseline). Record the tool-schema honoring quality as the before-bar. (Confirms the flag is genuinely off on non-quality — shared-path safety.) | Supabase `runs` succeeded. Backend log: no `require_parameters` in the request extra_body for this run. | _(operator fills)_ |
| R9 | XP (**OpenRouter AFTER — require_parameters**) | **OpenRouter** quality model | Set `openrouter_tool_strategy="quality"` (so `:exacto` + `plugins:[response-healing]` + `provider.require_parameters=true` all stack), run the **same** tool-using prompt as R8. | Routing **still succeeds** — **no 404/422** from the three-way `:exacto` + `plugins` + `require_parameters` interaction (RESEARCH **Pitfall 5**). Tool-schema honoring is **at least as good as R8** (require_parameters excludes upstreams that drop the schema). | Supabase `runs` succeeded (not 404/422). Backend log: `extra_body.provider.require_parameters=true` present; model carries `:exacto`. | _(operator fills)_ |

**Both D-01 rungs MUST be observed** — R4 (recovered) AND R5 (honest-fail). A scoreboard with only one rung is a FAIL (the ladder is unproven). The OpenRouter before (R8) / after (R9) pair MUST both route cleanly.

**Automated backstop reference (already green — Wave 1):** every SHAPE assertion behind these live rows is pinned by `backend/tests/test_129_minimax_argrepair.py` (8 passed) and `backend/tests/test_129_openrouter_require_params.py` (4 passed). The live scoreboard proves the BEHAVIOR those shapes produce under real provider traffic — it is not a substitute for the units, it is the load-bearing complement (T-129-09).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 + Plan 02 test files exist and are green — 4 + 8 passed)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (scoped)
- [ ] SC#10 4-axis scoreboard run LIVE — every row recorded PASS (recovered R4 + honest-fail R5 both observed; OpenRouter R8/R9 clean; OpenAI/Anthropic/Google R1–R3 byte-identical) — _Task 2 (operator-run checkpoint)_
- [ ] `nyquist_compliant: true` set in frontmatter — _flipped only on a fully clean live run (Task 2)_

**Approval:** pending — scoreboard authored (Plan 03 Task 1); awaiting the operator-run live SC#10 (Task 2).
