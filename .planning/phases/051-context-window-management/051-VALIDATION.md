---
phase: 51
slug: context-window-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.0.0 + pytest-asyncio (backend); vitest (frontend) |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` (check at execution time) |
| **Quick run command** | `pytest backend/tests/test_context_window.py -x` |
| **Full suite command** | `pytest backend/tests/ -x && npm run test --prefix frontend` |
| **Estimated runtime** | ~15 seconds (backend unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/test_context_window.py backend/tests/test_sub_agent_routing.py -x`
- **After every plan wave:** Run `pytest backend/tests/ -x`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 51-01-01 | 01 | 1 | CTX-01 | — | Generation keyword detection fires on pptx/powerpoint/presentation/report/document/pdf/spreadsheet/excel/csv export | unit | `pytest backend/tests/test_sub_agent_routing.py::test_generation_keywords -x` | ❌ W0 | ⬜ pending |
| 51-01-02 | 01 | 1 | CTX-01 | — | Escalated model = user_settings.llm_model; output ceiling = max(32768, slider) | unit | `pytest backend/tests/test_sub_agent_routing.py::test_escalated_model -x` | ❌ W0 | ⬜ pending |
| 51-01-03 | 01 | 1 | CTX-02 | — | Non-generation tasks use _SUB_AGENT_MODEL_DEFAULTS; ceiling = sub_agent_max_output_tokens | unit | `pytest backend/tests/test_sub_agent_routing.py::test_analysis_routing -x` | ❌ W0 | ⬜ pending |
| 51-02-01 | 02 | 1 | CTX-05 | — | tiktoken fires for gpt-* / o1 / o3 models; chars/4 for all others | unit | `pytest backend/tests/test_context_window.py::test_tiktoken_estimate -x` | ❌ W0 | ⬜ pending |
| 51-02-02 | 02 | 1 | CTX-05 | — | ImportError fallback logs once; chars/4 path works without tiktoken | unit | `pytest backend/tests/test_context_window.py::test_tiktoken_fallback -x` | ❌ W0 | ⬜ pending |
| 51-03-01 | 03 | 2 | CTX-03 | T-51-01 | sub_agent_max_output_tokens field range 4096–65536 validated in SettingsUpdate | unit | `pytest backend/tests/test_settings.py::test_sub_agent_output_tokens -x` | ❌ W0 | ⬜ pending |
| 51-03-02 | 03 | 2 | CTX-03 | — | GET /api/settings returns sub_agent_max_output_tokens; PATCH saves it | unit | `pytest backend/tests/test_settings.py::test_sub_agent_settings_roundtrip -x` | ❌ W0 | ⬜ pending |
| 51-04-01 | 04 | 2 | CTX-04 | — | MODEL_INFO keys align with MODEL_CONTEXT_DEFAULTS and _MODEL_OUTPUT_DEFAULTS | unit | `npm run test --prefix frontend -- src/lib/model-info.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_sub_agent_routing.py` — unit tests for CTX-01 and CTX-02 (keyword routing, model escalation, ceiling selection)
- [ ] `backend/tests/test_context_window.py` — add tiktoken test cases (CTX-05); file likely exists, needs new test functions
- [ ] `backend/tests/test_settings.py` — add sub_agent_max_output_tokens round-trip tests (CTX-03); file likely exists, needs new test functions
- [ ] `frontend/src/lib/model-info.test.ts` — MODEL_INFO key alignment test (CTX-04)

*Existing pytest and vitest infrastructure is in place; gaps are new test functions, not new framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slider renders correctly in Deep Midnight theme with accent-primary color | CTX-03 | Visual/CSS verification — cannot be automated without screenshot diffing | Open Settings → AI Model tab → verify "Context & Sub-Agent" section shows sliders with primary-colored thumb |
| Model info tooltip appears on hover of Info icon in model selector | CTX-04 | DOM hover interaction — not covered by vitest unit tests | Open chat → click model selector dropdown → hover the ℹ icon next to a known model → verify tooltip shows context/output/bestFor |
| Sub-agent generation task uses escalated model end-to-end | CTX-01 | Requires live sub-agent execution with an actual LLM call | Send a chat message requesting "create a PPTX presentation" → verify sub-agent log shows escalated model name |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
