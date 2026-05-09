---
phase: 066
slug: adaptive-run-timeouts-lifecycle-states
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 066 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Authoritative content lives in `066-RESEARCH.md` `## Validation Architecture` section.
> This file is the per-task ledger gsd-nyquist-auditor / executor will fill in.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (project standard) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/ -q` |
| **Estimated runtime** | ~30 seconds (subset) / ~3 minutes (full) |

Frontend Vitest is **deferred** per Phase 063.1 precedent (vitest unavailable on this dev machine due to npm optional-dep cascade). Frontend coverage is gated via TypeScript compilation; runtime execution defers to CI / fresh `npm install` env. Backstop = manual UAT in Plan 066-05.

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_066_*.py -x -q`
- **After every plan wave:** Run `cd backend && venv/Scripts/python.exe -m pytest tests/integration/ -q`
- **Before `/gsd-verify-work`:** Full suite must be green AND live UAT recorded in HUMAN-UAT.md
- **Max feedback latency:** 30 seconds (subset)

---

## Per-Task Verification Map

> Filled in by gsd-planner during plan-phase, then by gsd-executor as tasks complete.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {filled by planner} | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_066_per_call_timer.py` — covers SC#2 (timer firing, reset, tool-exec exclusion)
- [ ] `backend/tests/integration/test_066_status_enum.py` — covers SC#3 (CHECK constraint + Pydantic Literal)
- [ ] `backend/tests/integration/test_066_terminal_classification.py` — covers SC#4 + DELETE-write-cancelled partition guard
- [ ] `backend/tests/integration/test_066_sse_terminal.py` — covers SC#5 (SSE wire-format)
- [ ] `backend/tests/integration/test_066_langsmith_clean.py` — covers SC#7 (no GeneratorExit)
- [ ] Shared fixture: synthetic slow-LLM mock (extend Phase 058's slow-mock-LLM with "stall before yielding next chunk for N seconds" knob)
- [ ] `066-HUMAN-UAT.md` — covers SC#1 + live regression on Gap-006 prompt

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Complex multi-tool agent ("search → report → charts → docx") completes end-to-end | SC#1 | Real LLM + sandbox + Tavily + DOCX export — not mockable at integration-test fidelity | Re-run user's Gap-006 prompt in dev app at `http://localhost:5173/` (login `fhdmrd@gmail.com / 123456`); observe completion + final assistant + final tool render. Document in HUMAN-UAT.md. |
| LangSmith trace shows clean termination on real timeout | Live regression | LangSmith dashboard inspection — visual confirmation of trace tree | After SC#1 UAT, force a synthetic timeout (set per_call_budget=10s, run a slow-thinking prompt). Check LangSmith dashboard: trace tree should NOT contain `GeneratorExit` warning at `run_helpers.py:1680`. |
| Resume button re-fires on `timed_out` | SC#6 (frontend) | Vitest deferred — manual click test | After timed-out run, click Resume in chat; assert it re-POSTs original prompt with full conversation context. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
