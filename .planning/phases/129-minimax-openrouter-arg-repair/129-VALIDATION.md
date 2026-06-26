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
| TBD (planner fills) | — | — | MP-04 | T-129-xx | repair stays MiniMax-gated; no shared-path fork | unit | `pytest -k arg_repair` | ❌ W0 | ⬜ pending |

*Planner completes this map. The truncation-detection + one-shot re-ask (D-01) and the OpenRouter `require_parameters` injection (D-02) are unit-mockable; the recovered/failed honesty signal and cross-provider no-regression are SC#10 manual.*

---

## Wave 0 Requirements

- [ ] `backend/tests/` test file(s) for the MiniMax arg-repair / one-shot re-ask path (mock the OpenAI-compat client to return a truncated tool-args 400, assert exactly one re-ask then honest-fail; assert a successful re-ask emits the recovered signal)
- [ ] Unit assertion that `require_parameters` lands in the OpenRouter `extra_body` under `provider` ONLY on the `quality` strategy, and is ABSENT for non-OpenRouter providers (shared-path safety)

*If existing `openai_service` tests already provide fixtures, extend them rather than re-scaffold.*

---

## Manual-Only Verifications (SC#10 4-axis cross-provider scoreboard — LOAD-BEARING)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MiniMax repair recovered/failed rungs | MP-04 / SC#1 | needs a live MiniMax-M3 run that reproduces the truncated-args 400 (run `2c711ee4` class) | Drive a heavy `execute_code` prompt on MiniMax-M3; confirm the one-shot re-ask either recovers (run continues + quiet "recovered" signal) or fails honestly with the existing provider-error copy — never a silent swallow or partial dispatch |
| OpenRouter `require_parameters` before/after | MP-04 / SC#2 | provider-routing behavior only observable live | On `openrouter_tool_strategy="quality"`, confirm tool calls honor the schema better; confirm the `:exacto` + `plugins` + `require_parameters` three-way interaction (RESEARCH Pitfall 5) shows no routing regression |
| No regression on OpenAI / Anthropic / Google | MP-04 / SC#2 | shared-path byte-identical proof | SC#10 4-axis (cross-provider × multi-tool × parallel-thread × long-message): run the standard scoreboard on OpenAI/Anthropic/Google and confirm tool use is byte-identical to pre-129 (the MiniMax repair + OpenRouter flag are provider-gated and must not touch their path) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (scoped)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
