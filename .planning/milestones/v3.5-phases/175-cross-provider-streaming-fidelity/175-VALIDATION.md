---
phase: 175
slug: cross-provider-streaming-fidelity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 175 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `175-RESEARCH.md` › Validation Architecture. Backend-only, additive, D-14 (Deep Mode byte-identical). SC#10 4-axis coverage is MANDATORY (this phase touches streaming + provider routing).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (+ pytest-asyncio) |
| **Config file** | `backend/` pytest layout; tests under `backend/tests/unit/` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_openai_compat_dsml_strip.py tests/unit/test_threads_title_gen.py tests/unit/test_errors.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit -q` |
| **Estimated runtime** | ~30–60 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (+ the new test files as they land)
- **After every plan wave:** Run `cd backend && venv/Scripts/python -m pytest tests/unit -q`
- **Before `/gsd:verify-work`:** Full unit suite green **AND** the SC#10 live-UAT matrix (below) passed
- **Max feedback latency:** ~60 seconds (unit)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows are requirement-keyed until plans exist; the nyquist auditor reconciles task IDs → rows after `/gsd:plan-phase` and `/gsd:execute-phase`.

| Req | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|----------|------------|-----------|-------------------|-------------|--------|
| XPROV-01 | `reasoning_first` cap → `resolve_calling_mode` returns STRUCTURED (no `tools`/`reasoning_effort` param) | — | unit | `pytest tests/unit/test_reasoning_first_routing.py -x` | ❌ W0 | ⬜ pending |
| XPROV-01 | reasoning-tools-unsupported 400 → honest actionable copy (errors.py) | — | unit | `pytest provider_gateway/test_errors.py -x` (extend) | ⚠️ extend | ⬜ pending |
| XPROV-01 | gpt-5.6 Deep chat + tools → no 400, reasoning stays on | — | live-UAT | operator: gpt-5.6-class + tool prompt → run completes | manual | ⬜ pending |
| XPROV-02a | strip holds across chunk boundaries + **stream-end flush** | — | unit | `pytest tests/unit/test_openai_compat_dsml_strip.py -x` (add flush + long-input) | ⚠️ extend | ⬜ pending |
| XPROV-02b | detected leak → single `error` SSE event (existing vocabulary, post-drain hook) | — | unit/behavior | `pytest tests/unit/test_dsml_leak_signal.py -x` | ❌ W0 | ⬜ pending |
| XPROV-02 | 26+ tool-call DeepSeek turn → no dirty render + honest signal | — | live-UAT | operator: long DeepSeek tool-chain | manual | ⬜ pending |
| XPROV-03 | cross-provider utility-model override dropped → no `fallback_model` emit (suppress-when-fine) | — | unit | `pytest tests/unit/test_utility_model_guard.py -x` | ❌ W0 | ⬜ pending |
| XPROV-03 | same-provider override + flexible-provider passthrough preserved | — | unit | same file | ❌ W0 | ⬜ pending |
| XPROV-04 | SAFE model → reasoning-off param injected; UNSAFE model → NOT injected | — | unit | `pytest tests/unit/test_title_reasoning_off.py -x` (mock client, assert kwargs) | ❌ W0 | ⬜ pending |
| XPROV-04 | empty/refusal on SAFE provider still derives (no regression of closed title fix) | — | unit | extend `test_threads_title_gen.py` | ⚠️ extend | ⬜ pending |
| XPROV-04 | budget (30 / Google 160) + inline-await ordering byte-identical | — | unit | assert `_title_max_tokens` + call order unchanged | ⚠️ extend | ⬜ pending |
| XPROV-04 | real 4–6 word title per SAFE provider (DeepSeek / Kimi-k2.6 / GLM-4.6) | — | live-UAT | operator: first message per provider | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_reasoning_first_routing.py` — XPROV-01 `resolve_calling_mode` STRUCTURED gate + `native_tools` vs `reasoning_first` override ordering
- [ ] `backend/tests/unit/test_utility_model_guard.py` — XPROV-03 inferred-provider guard (drop cross-provider, keep same-provider, flexible passthrough, empty-`available_models` case)
- [ ] `backend/tests/unit/test_title_reasoning_off.py` — XPROV-04 param-injection matrix (SAFE injects, UNSAFE omits) + budget/ordering invariance + empty-response derive
- [ ] `backend/tests/unit/test_dsml_leak_signal.py` — XPROV-02b leak → single `error` event
- [ ] Extend `backend/tests/unit/test_openai_compat_dsml_strip.py` — stream-end flush + (if assumption A1 confirmed) alternate-opener coverage
- [ ] Extend `backend/app/services/provider_gateway/test_errors.py` — XPROV-01 reasoning-tools-unsupported classification/copy

---

## Manual-Only Verifications (SC#10 4-Axis — MANDATORY)

| Axis | Representative | Which fix it proves | Why Manual |
|------|---------------|---------------------|------------|
| **Cross-provider** | OpenAI gpt-5.6-class (XPROV-01) + one SAFE reasoning provider title (DeepSeek/Kimi-k2.6/GLM, XPROV-04) + Anthropic (unchanged control) + Google (XPROV-04 UNSAFE control — must still derive, no regression) | XPROV-01, XPROV-04 | Live endpoint constraint (400) + real per-provider title quality can't be mocked |
| **Multi-tool** | gpt-5.6 with `search_documents` + `execute_code` in one prompt | XPROV-01 (STRUCTURED XML tool path drives multiple tools) | Real tool execution across the XML-injection path |
| **Parallel-thread** | Thread A streaming (DeepSeek long turn) while Thread B accepts a new prompt (title-gen fires) | XPROV-02 + XPROV-03/04 isolation | Concurrency + timing |
| **Long-message** | DeepSeek ~26+ tool-call turn (the natural DSML-leak trigger) | XPROV-02 (no dirty render + honest signal) | Leak is length/timing-dependent; a wire-format mock cannot reproduce it |

*Unit-testable fixes: XPROV-01 routing + XPROV-03 guard + XPROV-04 param-injection (mock client, assert request kwargs / calling_mode / no fallback emit). Live-UAT-only: DSML long-turn leak (XPROV-02) and gpt-5.6-with-tools (XPROV-01).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] SC#10 all four axes exercised (cross-provider · multi-tool · parallel-thread · long-message)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
