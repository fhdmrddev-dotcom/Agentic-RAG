---
phase: 134
slug: eval-results-honest-verdict-ratings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 134 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `134-RESEARCH.md` → `## Validation Architecture`. **SC#10 applies (D-12)** — this
> phase touches provider routing (the judge is a second provider call per arm) + UI state, so
> the 4-axis manual UAT rows below are MANDATORY and live in this file (not in PLAN tasks).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) · Vitest (frontend — note pre-existing vitest rot, SEED-056; prefer live UAT for FE render) |
| **Config file** | `backend/` existing pytest suite (`backend/tests/`) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_eval_runner.py tests/test_evals_router.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~30–60 seconds (judge mocked in unit tests — no live provider calls) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/python -m pytest tests/test_eval_runner.py -x` (+ `tests/test_evals_router.py` once created)
- **After every plan wave:** Run `cd backend && venv/Scripts/python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full backend suite green, THEN the live SC#10 UAT rows below
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs finalized after `/gsd:plan-phase` writes PLAN.md files; rows below key the
> automated tests to requirements. Judge is mocked in all unit tests
> (`patch("...eval_runner_service._judge_eval_answer")` or `patch("...forced_emit")`).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | EVAL-03 | — | Completed with-skill arm → `verdict_state='graded'`, verdict fields persisted | unit | `pytest tests/test_eval_runner.py::test_completed_arm_graded -x` | ❌ W0 (extend) | ⬜ pending |
| TBD | TBD | 1 | EVAL-03 SC#1 | — | Errored/empty arm → `verdict_state='not_measured'`, `verdict_passed IS NULL`, judge fn NOT called | unit | `pytest tests/test_eval_runner.py::test_errored_arm_not_measured -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | EVAL-03 | — | Rollup: 1 pass / 1 fail → `passed_count=1`, `measured_count=2` | unit | `pytest tests/test_eval_runner.py::test_rollup_counts -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | EVAL-03 | T-134 (judge indep.) | Judge routed with explicit `provider=` (never `user_settings.active_provider`) | unit | `pytest tests/test_eval_runner.py::test_judge_provider_independent -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | EVAL-04 | — | `PUT up`→`GET` shows `up`; `PUT down`→`down`; `PUT null`→cleared (re-ratable round-trip) | integration | `pytest tests/test_evals_router.py::test_rating_round_trip -x` | ❌ W0 (new file) | ⬜ pending |
| TBD | TBD | 2 | EVAL-04 | T-134 (IDOR) | Cross-user `PUT rating` on another user's result → 404 (owner gate) | integration | `pytest tests/test_evals_router.py::test_rating_cross_user_404 -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | D-13/D-14 | — | Deep Mode byte-identical — `RunContext.skill_catalog_override` default-off; no agent_loop edits | grep guard | `pytest tests/ -k skill_catalog_override` + no-diff assert on `agent_loop.py` | ✅ (133) re-affirm | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `backend/tests/test_eval_runner.py` — verdict / not_measured / rollup / judge-provider-independence cases (the file already fakes `run_agent_loop` + supabase + redis at `test_eval_runner.py:19-75`; mock `forced_emit`/`_judge_eval_answer`)
- [ ] **NEW** `backend/tests/test_evals_router.py` — ratings endpoint round-trip + IDOR 404. No API-level eval router test exists today (only service-level `test_eval_runner.py`). Model on the existing FastAPI `TestClient` router tests + the `get_supabase` fake.
- [ ] (Optional) frontend render coverage deferred to live UAT below given vitest rot (SEED-056)

---

## Manual-Only Verifications — SC#10 4-Axis UAT (D-12, MANDATORY)

> Authored here, NOT in PLAN tasks. The judge adds a second (independent-model) provider call
> per arm, so UAT must prove the verdict is honest across providers AND include an intentional
> errored-arm row (U8) proving `not_measured` renders instead of a fabricated score.
> Drive via Chrome MCP or operator-clicks (Chrome-MCP-hangs fallback, `feedback_chrome_mcp_testing`).

| # | Axis | Requirement | Scenario | Honest-verdict assertion |
|---|------|-------------|----------|--------------------------|
| U1 | Cross-provider: OpenAI | EVAL-03 | Eval a skill with a gpt-5.x model; cases complete | With/without arms graded; judge (`claude-opus-4-8`) verdict renders; verdict line reads "X/N passed" |
| U2 | Cross-provider: Anthropic | EVAL-03 | Eval with claude-opus/sonnet (provider-under-test == judge provider) | Judge still independent-model-resolved; verdict honest; no self-judge shortcut |
| U3 | Cross-provider: Google | EVAL-03 | Eval with gemini-3.x | Single-typed verdict fields survive (no Gemini `type:[...]` trap); verdict renders |
| U4 | Cross-provider: OpenRouter | EVAL-03 | Eval with an OpenRouter representative | Verdict honest; OpenRouter treated as experimental (native-safe) |
| U5 | Multi-tool | EVAL-03 | A case whose prompt exercises 2+ tools (`search_documents` + `execute_code`) with-skill | The multi-tool answer is graded; verdict reflects the actual deliverable |
| U6 | Parallel-thread | EVAL-03 | Eval run streaming on skill A while chat thread B streams | No cross-talk; `eval_*`/verdict events only on the eval run buffer; both readouts correct |
| U7 | Long-history | EVAL-03 | A case with a ≥5 KB prompt (or long accumulated eval-thread context) | Grading completes; no truncation of the verdict (forced-emit truncation-safe) |
| **U8** | **Intentional errored arm (D-12 mandatory)** | **EVAL-03 SC#1 / D-04 / D-11** | **without-skill baseline on `claude-sonnet-5` → hits BUG-260701-01 (assistant-prefill 400)** | **The without-skill arm shows `not_measured` (NEVER a fabricated score); the with-skill arm, if it completes, still grades; rollup counts only measured cases** |
| U9 | Ratings persistence | EVAL-04 | Thumbs up/down an answer, reload the run, re-rate (toggle/clear) | Rating persists across reload; re-rating updates; a thumbs-DOWN on a judge-PASSED answer is captured (human↔judge disagreement signal for SI-01) |

*U8 doubles as concrete proof of EVAL-03 SC#1 + D-04 + D-11 (the deferred cross-provider bug surfaces honestly).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`test_eval_runner.py` extend + `test_evals_router.py` new)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] SC#10 4-axis UAT (U1–U9) executed live before phase close (D-12)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
