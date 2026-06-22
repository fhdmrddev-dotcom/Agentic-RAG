---
phase: 122
slug: cross-provider-trust-honesty-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
plans_bound: 2026-06-23
---

# Phase 122 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Plan/task IDs bound at plan-time (2026-06-23). Reconcile to executed reality at `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | `pytest` (+ `pytest-asyncio`) — backend venv |
| **Framework (frontend)** | `vitest` (the `inferLabel`/`humanize` floor in `frontend/src/lib/workspacePanel.ts`) |
| **Config file** | `backend/pytest.ini` / `pyproject.toml`; `frontend/vitest.config.*` |
| **Quick run command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_forced_emit.py -x -q` |
| **Full suite command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| **Frontend label tests** | `cd frontend && npx vitest run src/lib/workspacePanel.test.ts` |
| **Operator-run eval (NOT pytest)** | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --forced-emit` (localhost-gated; the MP-03 scoreboard) |
| **Estimated runtime** | ~30s backend unit · ~10s frontend · eval = operator-driven (minutes, live keys) |

---

## Sampling Rate

- **After every task commit:** Run the relevant unit file (`pytest …/test_forced_emit.py -x` or the vitest label file).
- **After every plan wave:** Run the backend unit suite + the frontend label suite (deterministic, fast, no live keys).
- **Before `/gsd:verify-work`:** Full backend suite green + frontend label suite green.
- **Phase gate (MP-03, D-122-06):** the operator-run `--forced-emit` scoreboard attached to VALIDATION.md + the SC#10 4-axis cross-provider UAT (no bare label; Deep byte-identical).
- **Max feedback latency:** ~30 seconds (unit); operator-gated for the live scoreboard.

---

## Plan → Requirement Map (bound at plan-time, 2026-06-23)

| Plan | Wave | Requirement | Objective |
|------|------|-------------|-----------|
| 122-01 | 1 | MP-02 | `emit_tier` field + 55-row migration (14/2/34/5) + remove the `provider=="openai"` gate + inert DeepSeek strict |
| 122-02 | 2 | MP-01 | the ordered rung-loop ladder inside `forced_emit` (reads `emit_tier`) + emit_rung telemetry |
| 122-03 | 3 | MP-03 | `--forced-emit` scoreboard matrix (EASY+HARD × native-7, 4 axes) + dated artifact + README ritual |
| 122-04 | 1 | TDP-01 | ungated `execute_code.description` nudge + verified frontend label floor |

**Wave plan:** Wave 1 = {122-01 MP-02, 122-04 TDP-01} (no file overlap, parallel) → Wave 2 = {122-02 MP-01} (reads `emit_tier`) → Wave 3 = {122-03 MP-03} (scores the real ladder).

---

## Per-Requirement Verification Map

> Task = `<plan>-T<n>`. The operator-run scoreboard + the live SC#10 UAT are the two documented manual exceptions.

| Req | Plan/Task | Behavior | Test Type | Automated Command | File Exists |
|-----|-----------|----------|-----------|-------------------|-------------|
| MP-01 | 122-02-T2 | strict-400 → non-strict/coerce recovery (the ladder recovers instead of going dark) | unit (deterministic, gateway-patched) | `pytest backend/tests/unit/test_forced_emit.py -k ladder -x` | ❌ W0 — Plan 02 |
| MP-01 | 122-02-T2 | each rung is tier-scoped (coerce-tier never runs the strict rung) | unit | `pytest backend/tests/unit/test_forced_emit.py -k tier_scoped -x` | ❌ W0 — Plan 02 |
| MP-01 | 122-02-T1 | all consumers byte-identical on the happy path (llm_emit/judge/NL/metadata) | unit (existing, extend) | `pytest backend/tests/unit/test_llm_emit_executor.py backend/tests/unit/test_validator_kinds.py -q` | ✅ verify `emit_rung`-on-success |
| MP-02 | 122-02-T2 | `emit_tier` resolves; default-SAFE `coerce` on registry miss | unit | `pytest backend/tests/unit/test_forced_emit.py -k emit_tier_default -x` | ❌ W0 — Plan 02 |
| MP-02 | 122-01-T2 | the `provider=="openai"` gate is gone — json_schema requested for `force_strict` tier without a name check | unit (gateway-request capture) | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_gate -x` | ❌ W0 — Plan 01 |
| MP-02 | 122-01-T2 | inert DeepSeek function-level strict removed; DeepSeek tier == `force` | unit + registry assertion | `pytest backend/tests/unit/test_gateway_forcing.py -k deepseek_force -x` | ❌ W0 — Plan 01 |
| MP-02 | 122-01-T1 | every registry row has a valid `emit_tier`; 14 `force_strict` (OpenAI-only), 0 `force_strict` non-OpenAI | unit (registry invariant) | `pytest backend/tests/unit/test_config_registry.py -k emit_tier -x` | ❌ W0 — Plan 01 |
| MP-02 | 122-01-T2 | (A4) OpenAI `force_strict` json_schema preserved after removing the function-level strict block | unit (gateway-request capture) | `pytest backend/tests/unit/test_gateway_forcing.py -k openai_force_strict -x` | ❌ W0 — Plan 01 |
| MP-03 | 122-03-T1 | scoreboard runs 4 axes per provider on EASY+HARD schemas, writes dated artifacts, PASS/FAIL/DOCUMENTED cells | **operator-run / localhost-gated** (NOT pytest) | `scripts/eval_cross_provider.py --forced-emit` → attach `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` | ❌ W0 — Plan 03 |
| MP-03 | 122-03-T2 | artifact writer + axis scoring + localhost gate correct (structure) | unit (fake gateway, no live keys) | `pytest backend/tests/unit/test_eval_forced_emit.py -x` | ❌ W0 — Plan 03 |
| TDP-01 | 122-04-T2 | `humanize()` precedence holds (`description > inferLabel(code) > "Run code"`); non-mapped tool shows bare name | unit (frontend) | `npx vitest run src/lib/workspacePanel.test.ts` | ❌ W0 — Plan 04 |
| TDP-01 | 122-04-T1 | the `SYSTEM_PROMPT` carries the nudge sentence (string presence) | unit | `pytest backend/tests/unit/test_system_prompt.py -k execute_code_label -x` | ❌ W0 — Plan 04 |
| TDP-01 | 122-04 (UAT) | NO provider shows a bare tool name (live panel) | **manual / Chrome MCP (G-4 + SC#10)** | UAT — drive `execute_code` per provider, screenshot the panel label | ❌ W0 — authored below |
| SC#5 | 122-02-T1 | Deep Mode byte-identical (no shared-path fork) across the native-7 | unit (092.5 guard) + UAT | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_branch_leaks -q` + SC#10 | ✅ re-run the 092.5 guard |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_config_registry.py` — NEW: registry invariant (every row has `emit_tier`; `force_strict` ⊆ OpenAI; 14 rows) [Plan 01]
- [ ] `backend/tests/unit/test_gateway_forcing.py` — ADD no-provider-gate + DeepSeek-force + OpenAI-force_strict(A4) + Deep-no-branch-leak assertions [Plan 01/02]
- [ ] `backend/tests/unit/test_forced_emit.py` — ADD ladder rung-descent + tier-scoping + `emit_tier` default tests (extend `_patch_gateway`; first `open_stream` raises → next rung succeeds) [Plan 02]
- [ ] `backend/tests/unit/test_eval_forced_emit.py` — NEW: structure-only test of the `--forced-emit` matrix + artifact writer (fake gateway, no live keys) [Plan 03]
- [ ] `backend/tests/unit/test_system_prompt.py` — NEW: string-presence guard for the `execute_code.description` nudge [Plan 04]
- [ ] `frontend/src/lib/workspacePanel.test.ts` — NEW: `humanize` precedence + a bare-name assertion for a non-mapped tool (verify, not rebuild) [Plan 04]
- [ ] `.planning/eval/README.md` — extend with the forced-emit scoreboard ritual (mirrors the capability-table grep ritual) [Plan 03]

*Framework already present — no install needed (`pytest` + `pytest-asyncio` + `vitest` all configured).*

---

## Manual-Only Verifications

> The two documented exceptions per Sign-Off: the operator-run scoreboard (D-122-06) + the live SC#10 cross-provider UAT.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-provider forced-emit scoreboard (4 axes × native-7, EASY + HARD schema) | MP-03 | Needs live cross-provider keys; localhost-gated by design (D-122-06) — never in CI (secrets + cost + flakiness) | Run `scripts/eval_cross_provider.py --forced-emit` against localhost Supabase with live keys; attach the dated `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` to this file; grep it before any `emit_tier` flip |
| No provider shows a bare tool name (live execution panel) | TDP-01 | Requires rendering the real frontend panel per provider (G-4 lived-experience gate) | Chrome MCP — for each native-7 provider, send a prompt that triggers `execute_code`; assert the panel label is the concrete `description`/inferred summary, never the bare `execute_code` |

---

## SC#10 4-Axis Cross-Provider UAT (the EVAL axis — per MP-03; authored here, NOT in PLAN tasks)

> Per the project UAT scoreboard recipe (CLAUDE.md): cross-provider × multi-tool × parallel-thread × long-message. Phase verification passes only when **all four axes are exercised**. The live scoreboard (MP-03) covers cross-provider × force/recovery automated; the rows below are the lived-experience G-4 backstop. Author the result table at `/gsd:verify-work`.

| # | Axis exercised | Provider(s) | Scenario | Pass condition |
|---|----------------|-------------|----------|----------------|
| UAT-1 | **Cross-provider** (OpenAI rep) | OpenAI `gpt-5.4-mini` | Send a prompt that forces a typed emission on the HARD schema (a workflow `llm_emit` or a metadata extraction). | The emission succeeds (recovered if needed); the panel label is a concrete `description`, never bare `execute_code`. Deep turn after is byte-identical. |
| UAT-2 | **Cross-provider** (Anthropic rep) | Anthropic `claude-haiku-4-5` | Same forced-emit prompt. | Emission succeeds; label concrete; Deep byte-identical (no shared-path fork). |
| UAT-3 | **Cross-provider** (Google rep) | Google `gemini-3.5-flash` | Same forced-emit prompt. | Emission succeeds (recovery rung if it 400s); label concrete. |
| UAT-4 | **Cross-provider** (DeepSeek rep) | DeepSeek `deepseek-v4-flash` | Same forced-emit prompt on the HARD schema (the live trip-wire). | The ladder recovers via the coerce rung (declared `emit_tier=force`) — NOT a silent None (folds BUG-260615-01). Label concrete. |
| UAT-5 | **Multi-tool** | one representative provider | One prompt that exercises 2+ tools in a single turn (e.g. `search_documents` + `execute_code`). | Each tool's panel row carries a concrete label; no bare snake_case name for either tool (Pitfall 4 — if a non-`execute_code` tool shows bare, that triggers the `PRETTY_TOOL_NAMES` extension per D-122-08). |
| UAT-6 | **Parallel-thread** | two providers | Thread A streams a forced-emit/long run while Thread B accepts a new prompt that also forces an emission. | Both threads recover-or-honest independently; neither thread's labels nor emission bleed into the other; Deep byte-identical in both. |
| UAT-7 | **Long-message** | one representative provider | A forced emission in a thread with ≥ 50 prior messages OR a ≥ 5 KB user prompt. | The ladder still recovers-or-honest; the label is concrete; no truncation-induced silent failure (the truncation guard descends honestly). |

**Coverage check (all 4 axes required):** cross-provider = UAT-1..4 (OpenAI/Anthropic/Google/DeepSeek reps) · multi-tool = UAT-5 · parallel-thread = UAT-6 · long-message = UAT-7. Plus the no-bare-label panel check (TDP-01) and Deep-byte-identical (SC#5) ride every row.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (operator-run scoreboard + live SC#10 UAT are the two documented manual exceptions)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter (at validate-phase, after reconciliation)

**Approval:** pending
