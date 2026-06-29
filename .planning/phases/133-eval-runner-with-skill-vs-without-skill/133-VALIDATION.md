---
phase: 133
slug: eval-runner-with-skill-vs-without-skill
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-30
---

# Phase 133 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `133-RESEARCH.md` § Validation Architecture. SC#10 axes are authored HERE (mandatory — not in PLAN tasks).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, in `backend/` venv); vitest (frontend — thin surface, minimal) |
| **Config file** | existing backend pytest config (the tuner / skill_test_cases tests are the template) |
| **Quick run command** | `cd backend && . venv/Scripts/activate && pytest tests/test_eval_runner.py -x` |
| **Full suite command** | `cd backend && . venv/Scripts/activate && pytest -q` (exclude known SEED-056 / 075.4-TEST-TRIAGE rot) |
| **Estimated runtime** | ~30–90 seconds (mocked provider in unit tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (minus pre-existing rot baseline)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Planner fills Task IDs once plans are written. Required observable truths per success criterion (from RESEARCH § Phase Requirements → Test Map):

| SC | Behavior | Test Type | Automated Command | File Exists |
|----|----------|-----------|-------------------|-------------|
| SC1 | Each case executed twice → exactly 2 `eval_results` rows per case (variant `with_skill` + `without_skill`) | integration | `pytest tests/test_eval_runner.py::test_two_results_per_case -x` | ❌ W0 |
| SC1 | WITH arm injects ONLY the target skill; WITHOUT injects nothing (catalog override honesty) | unit | `pytest tests/test_agent_loop_catalog_override.py -x` | ❌ W0 |
| SC2 | `eval_case_started`/`eval_case_done` events land on `run:{run_id}` in order; no chat terminal types mid-run | unit | `pytest tests/test_eval_runner.py::test_sse_vocabulary -x` | ❌ W0 |
| SC3 | Results persist per-case; readable via GET after the buffer is gone (simulate TTL expiry) | integration | `pytest tests/test_eval_runner.py::test_results_persist_after_buffer_expiry -x` | ❌ W0 |
| SC3 | Reattach: companion `runs` row makes `getActiveRuns` list the eval run; `subscribeToRun(since=0)` replays | integration | `pytest tests/test_eval_runner.py::test_reattach_via_runs_row -x` | ❌ W0 |
| SC4 | **Deep Mode byte-identical** — `RunContext` with `skill_catalog_override=None` produces the identical catalog query + system prompt as today | regression (unit) | `pytest tests/test_agent_loop_catalog_override.py::test_deep_mode_unchanged -x` | ❌ W0 |
| SC4 | Owner-scoping: user B cannot launch/stream/read user A's eval run → 404 | integration | `pytest tests/test_eval_runner.py::test_cross_user_404 -x` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_eval_runner.py` — covers SC1/SC2/SC3 + cross-user 404
- [ ] `backend/tests/test_agent_loop_catalog_override.py` — covers the additive `RunContext.skill_catalog_override` field + the **Deep-Mode-unchanged regression** (the shared-path guard / SC#4 truth)
- [ ] Shared fixtures: a seeded skill + skill_version + 2 `skill_test_cases` owned by a test user; a fake/mock provider for the inner `run_agent_loop` so unit tests don't hit a real LLM (mirror existing tuner test mocks)

---

## Manual-Only Verifications — SC#10 4-Axis UAT Bandwidth (MANDATORY)

> This phase touches streaming + agent loop + provider routing + UI state. These rows are authored here, NOT in PLAN tasks. Long-history stays manual per provider.

| Axis | Behavior | Requirement | Why Manual | Test Instructions |
|------|----------|-------------|------------|-------------------|
| Cross-provider | Launch an eval run on each of OpenAI, Anthropic, Google, OpenRouter (representative model per axis) | EVAL-02 / SC#10 | Needs live provider keys + real completions | For each provider: pick it at launch, run a 2-case eval, confirm both arms complete and the WITH arm visibly loads the target skill (and only that skill) |
| Multi-tool | ≥1 test case whose prompt exercises 2+ tools (e.g. `search_documents` + `execute_code`) under the WITH arm | EVAL-02 / SC#10 | Proves the full loop runs (not a single emission) | Author a test case whose prompt forces 2 tools; run the eval; confirm the WITH-arm completion actually used both tools |
| Parallel-thread | An eval run streaming while a normal Deep chat thread accepts a new prompt | EVAL-02 / SC#10 | Concurrency / buffer-isolation is runtime behavior | Start an eval run, then send a Deep chat prompt in another thread; confirm the eval buffer and chat buffer don't interfere (distinct `run_id`s; neither stream corrupts the other) |
| Long-history | A test case with a ≥5 KB prompt (or run after a long chat thread exists) | EVAL-02 / SC#10 | Trim path is runtime + size-dependent | Run an eval with a ≥5 KB prompt; confirm history-trim + completion still work in the eval thread |
| Deep-byte-identical backstop | A normal Deep chat turn (no eval) after `skill_catalog_override` lands | SC#4 | Live confirmation the shared path is untouched | Run a normal Deep chat turn; confirm catalog injection + streaming are unchanged vs. pre-phase behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
