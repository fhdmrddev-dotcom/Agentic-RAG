---
phase: 122
slug: cross-provider-trust-honesty-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 122 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Plan-time draft (sourced from 122-RESEARCH.md §Validation Architecture). Task IDs bind during planning; reconcile to executed reality at `/gsd:validate-phase`.

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

## Per-Requirement Verification Map

> Task IDs (`122-NN-MM`) are assigned by the planner; this map is keyed by requirement until then.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| MP-01 | strict-400 → non-strict/coerce recovery (the ladder recovers instead of going dark) | unit (deterministic, gateway-patched) | `pytest backend/tests/unit/test_forced_emit.py -k ladder -x` | ❌ W0 — extend `test_forced_emit.py` with a rung-descent test on `_patch_gateway` (first `open_stream` raises → next rung succeeds) |
| MP-01 | each rung is tier-scoped (coerce-tier never runs the strict rung) | unit | `pytest backend/tests/unit/test_forced_emit.py -k tier_scoped -x` | ❌ W0 |
| MP-01 | all consumers byte-identical on the happy path (llm_emit/judge/NL/metadata) | unit (existing, extend) | `pytest backend/tests/unit/test_llm_emit_executor.py test_validator_kinds.py test_103_nl_generate.py -q` | ✅ extend with `emit_rung`-on-success assertion |
| MP-02 | `emit_tier` resolves; default-SAFE `coerce` on registry miss | unit | `pytest backend/tests/unit/test_forced_emit.py -k emit_tier_default -x` | ❌ W0 |
| MP-02 | the `provider=="openai"` gate is gone — json_schema requested for `force_strict` tier without a name check | unit (gateway-request capture) | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_gate -x` | ❌ W0 — mirror the `request.strict_schema` capture in `test_103_forced_emit_strict.py` |
| MP-02 | inert DeepSeek function-level strict removed; DeepSeek tier == `force` | unit + registry assertion | `pytest backend/tests/unit/test_gateway_forcing.py -k deepseek_force -x` | ❌ W0 |
| MP-02 | every registry row has a valid `emit_tier`; 14 `force_strict` (OpenAI-only), 0 `force_strict` non-OpenAI | unit (registry invariant) | `pytest backend/tests/unit/test_config_registry.py -k emit_tier -x` | ❌ W0 |
| MP-03 | scoreboard runs 4 axes per provider on EASY+HARD schemas, writes dated artifacts, PASS/FAIL/DOCUMENTED cells | **operator-run / localhost-gated** (NOT pytest) | `scripts/eval_cross_provider.py --forced-emit` → attach `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` | ❌ W0 — extend the driver; CI proves *structure* only |
| MP-03 | artifact writer + axis scoring + localhost gate correct (structure) | unit (fake gateway, no live keys) | `pytest backend/tests/unit/test_eval_forced_emit.py -x` | ❌ W0 — structure-only; live proof is the operator run |
| TDP-01 | `humanize()` precedence holds (`description > inferLabel(code) > "Run code"`); non-mapped tool behavior asserted | unit (frontend) | `npx vitest run src/lib/workspacePanel.test.ts` | ✅ verify; add a bare-name assertion |
| TDP-01 | the `SYSTEM_PROMPT` carries the nudge sentence (string presence) | unit | `pytest backend/tests/unit/test_system_prompt.py -k execute_code_label -x` | ❌ W0 — string-presence guard so the nudge can't be silently deleted |
| TDP-01 | NO provider shows a bare tool name (live panel) | **manual / Chrome MCP (G-4 + SC#10)** | UAT — drive `execute_code` per provider, screenshot the panel label | ❌ W0 — authored below |
| SC#5 | Deep Mode byte-identical (no shared-path fork) across the native-7 | unit (092.5 guard) + UAT | `pytest backend/tests/unit/test_gateway_forcing.py -k no_provider_branch_leaks -q` + SC#10 | ✅ re-run the 092.5 guard test |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_forced_emit.py` — ADD ladder rung-descent + tier-scoping + `emit_tier` default tests (extend the existing `_patch_gateway` fixture; first `open_stream` raises → next rung succeeds)
- [ ] `backend/tests/unit/test_gateway_forcing.py` — ADD no-provider-gate + DeepSeek-force + Deep-no-branch-leak assertions
- [ ] `backend/tests/unit/test_config_registry.py` — NEW: registry invariant (every row has `emit_tier`; `force_strict` ⊆ OpenAI)
- [ ] `backend/tests/unit/test_eval_forced_emit.py` — NEW: structure-only test of the `--forced-emit` matrix + artifact writer (fake gateway, no live keys)
- [ ] `backend/tests/unit/test_system_prompt.py` — ADD a string-presence guard for the `execute_code.description` nudge
- [ ] `frontend/src/lib/workspacePanel.test.ts` — verify/extend with a bare-name assertion for a non-mapped tool
- [ ] `.planning/eval/README.md` — extend with the forced-emit scoreboard ritual (mirrors the capability-table grep ritual)

*Framework already present — no install needed (`pytest` + `pytest-asyncio` + `vitest` all configured).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-provider forced-emit scoreboard (4 axes × native-7, EASY + HARD schema) | MP-03 | Needs live cross-provider keys; localhost-gated by design (D-122-06) — never in CI (secrets + cost + flakiness) | Run `scripts/eval_cross_provider.py --forced-emit` against localhost Supabase with live keys; attach the dated `.planning/eval/forced-emit-scoreboard-<date>.{json,md}` to this file; grep it before any `emit_tier` flip |
| No provider shows a bare tool name (live execution panel) | TDP-01 | Requires rendering the real frontend panel per provider (G-4 lived-experience gate) | Chrome MCP — for each native-7 provider, send a prompt that triggers `execute_code`; assert the panel label is the concrete `description`/inferred summary, never the bare `execute_code` |
| SC#10 4-axis cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message) | SC#5 / MP-03 | Live streaming behavior across providers + parallel threads can't be faithfully mocked | Author SC#10 rows per the UAT scoreboard recipe; prove Deep byte-identical and the recovery ladder + label nudge both hold live |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (operator-run scoreboard + live UAT are the two documented manual exceptions)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter (at validate-phase, after reconciliation)

**Approval:** pending
