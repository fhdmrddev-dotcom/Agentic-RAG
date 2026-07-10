---
phase: 142
slug: non-python-skill-script-honesty-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 142 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `142-RESEARCH.md` §Validation Architecture. Task IDs finalized by the planner;
> rows below anchor on Requirement/SC + the automated command that proves it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (`asyncio_mode = auto`) + frontend Vitest |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_sandbox_tools.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` (+ `cd frontend && npm run test` for the import-render change) |
| **Estimated runtime** | ~30 seconds (quick); full backend suite ~2–4 min |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (dispatcher + sandbox-tools unit tests)
- **After every plan wave:** `cd backend && venv/Scripts/python -m pytest tests/unit tests/integration -q` + the frontend import test
- **Before `/gsd:verify-work`:** Full backend suite green + frontend build/test green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (detection) | TBD | 1 | SRH-01 / SC#2 · D-06 | T-142-01 | classifier hits G-A/G-B/G-C only on KNOWN_MISSING token + "not found" phrase (or JS token + SyntaxError) — never on error-type/exit-code alone | unit | `pytest tests/unit/test_142_runtime_gap.py::test_classify_gc_soffice -x` | ❌ W0 | ⬜ pending |
| TBD (passthrough) | TBD | 1 | SRH-01 / SC#2 | T-142-01 | genuine `ValueError` / missing user file / real `SyntaxError` pass through unchanged (NO reshape) | unit | `pytest tests/unit/test_142_runtime_gap.py::test_non_gap_passthrough -x` | ❌ W0 | ⬜ pending |
| TBD (repeat-guard) | TBD | 1 | SRH-01 / SC#2 · D-06 | T-142-04 | a 2nd execute_code on an already-failed token short-circuits WITHOUT invoking the sandbox (N sandbox calls → 1) | unit (mock session) | `pytest tests/unit/test_142_repeat_guard.py::test_repeat_short_circuits -x` | ❌ W0 | ⬜ pending |
| TBD (run-scope) | TBD | 1 | SRH-01 / D-06 | T-142-05 | guard set shared across per-iteration ToolContext builds, FRESH for sub-agents (by-reference, not setattr) | unit | `pytest tests/unit/test_142_repeat_guard.py::test_run_scoped_not_setattr -x` | ❌ W0 | ⬜ pending |
| TBD (proactive desc) | TBD | 1 | SRH-01 / D-05a | — | `EXECUTE_CODE_TOOL.description` contains capability facts (available + NOT-available tokens) | unit | `pytest tests/unit/test_sandbox_tools.py::test_execute_code_capability_facts -x` | ❌ W0 (extend) | ⬜ pending |
| TBD (load_skill flag) | TBD | 1 | SRH-01 / D-05b | — | `_handle_load_skill` attaches a runtime note when file list has a `.js`; none when all-Python | unit | `pytest tests/unit/test_142_load_skill_flag.py -x` | ❌ W0 | ⬜ pending |
| TBD (read_skill_file) | TBD | 1 | SRH-01 / SC#3 · D-11 | T-142-02 | `.js`/`.sh` return reference text + caveat; live path == 099 snapshot path (byte-symmetry) | unit | `pytest tests/unit/test_142_read_skill_file.py -x` | ❌ W0 | ⬜ pending |
| TBD (import note) | TBD | 1 | SRH-01 / SC#1 · D-08 | T-142-03 | `.js`-bundling ZIP returns a non-blocking note; all-Python ZIP does not; 200 AND 202 paths | integration | `pytest tests/integration/test_skills_import_export.py::TestImportSkill::test_import_note_for_js -x` | ❌ W0 (extend) | ⬜ pending |
| TBD (BUG-260707-02 fold) | TBD | 1 | SRH-01 / D-03 | T-142-01/04 | generic mechanism stops the soffice/markitdown repeat loop (simulated multi-round) | unit/integration | `pytest tests/unit/test_142_repeat_guard.py::test_pptx_soffice_loop_capped -x` | ❌ W0 | ⬜ pending |
| TBD (import render) | TBD | 2 | SRH-01 / SC#1 | — | `SkillsPage.handleImport` surfaces the note text | frontend | `cd frontend && npm run test -- SkillsPage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_142_runtime_gap.py` — classifier hits (G-A/G-B/G-C) + pass-through negatives (threat #1). Covers SC#2.
- [ ] `backend/tests/unit/test_142_repeat_guard.py` — repeat short-circuit + run-scope-not-setattr + loop-cap (D-03). Uses the `make_tool_context` fixture (`conftest.py:621`) + a mock sandbox session (see `test_sandbox_tools.py`).
- [ ] `backend/tests/unit/test_142_load_skill_flag.py` — D-05b flag present/absent.
- [ ] `backend/tests/unit/test_142_read_skill_file.py` — SC#3 decode + 099 byte-symmetry (mirror `test_099_skill_composition` shape).
- [ ] Extend `backend/tests/unit/test_sandbox_tools.py` — D-05a capability-facts assertion.
- [ ] Extend `backend/tests/integration/test_skills_import_export.py` — SC#1 import note (200 + 202 paths), reuse the `_make_zip` / `_valid_skill_md` helpers (`:66-78`).
- [ ] Frontend: extend/add a `SkillsPage` test for the note render.

*Shared fixtures already exist (`make_tool_context`, `_make_zip`, `mock_builder`, `_supabase`) — no new conftest fixture required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider honest narration (OpenAI, Anthropic, Google, OpenRouter) | SRH-01 / SC#2 (SC#10-adjacent) | Model narration is behavioral, not deterministic — the guard caps the loop, but "tells the user honestly it can't run this step" is provider-dependent | Load the stock pptx skill (or a `.js`-bundling skill), prompt a task that drives its soffice/markitdown QA step. Per provider assert: agent does NOT loop (≤1 real dead sandbox call per token), tells the user honestly, completes via the in-memory path. OpenRouter best-effort. |
| Multi-tool row | SRH-01 / SC#2 | Exercises `load_skill` flag + `execute_code` reshape together in one live turn | One prompt that loads a skill (surfacing the flag) AND drives its dead sandbox step (surfacing the reshape). Assert both the flag and the honest reshape appear. |
| D-03 stock-skill proof | SRH-01 / D-03 | Confirms the fix is generic (not the per-user BUG-260707-02 data-fix) | Re-import the STOCK Anthropic pptx skill (unmodified instructions referencing soffice/markitdown), run a pptx task, confirm no retry loop. |

*Long-message / parallel-thread axes: low relevance (no streaming/UI-state change) — a single representative row suffices per SC#10 minimum.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
