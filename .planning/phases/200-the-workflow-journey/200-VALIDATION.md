---
phase: 200
slug: the-workflow-journey
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-19
---

# Phase 200 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `200-RESEARCH.md` § Validation Architecture (measured, not inferred).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | vitest + `@testing-library/react`, jsdom |
| **Framework (backend)** | pytest |
| **Config file** | `frontend/vitest.config.ts` · `backend/pytest.ini` + `backend/tests/conftest.py` |
| **Quick run (frontend)** | `cd frontend && npx vitest run <path> --reporter=basic` |
| **Quick run (backend)** | `backend/venv/Scripts/python.exe -m pytest <file> -q --no-header` |
| **Full suite (frontend gate)** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` — **from the repo root** |
| **Full suite (backend)** | `backend/venv/Scripts/python.exe -m pytest tests/unit -q` |
| **Typecheck** | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (⚠ bare `tsc --noEmit` checks ZERO files) |
| **Estimated runtime** | frontend gate ~4-6 min · backend unit ~3 min |

### Measured baselines (2026-08-19, re-derive — they have rotted five times)

| Gate | Baseline |
|---|---|
| Frontend count gate | `total 4970 · failed 0 · pinned total 4543 · 96/96 pinned files present` |
| Backend `tests/unit` | **62 failed / 2350 passed** (pre-existing) |
| Wire-slice backend suites | **1 failed / 121 passed** — the one is pre-existing and IN the blast radius: `test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` (`assert body["locked"] is True`) |

⚠ CLAUDE.md's published figures (`4594 · 4328 · 92/92`) are **stale by one day**. A bigger number is the gate WORKING; its contract is *no per-file DECREASE* and *zero failing*, never a fixed grand total.

---

## Sampling Rate

- **After every task commit:** the touched suite only — `npx vitest run <file>` / `pytest <file> -q`
- **After every plan wave:** count gate (repo root, cap 2) **+** `pytest tests/unit -q` **+** `tsc -p tsconfig.app.json --noEmit`
- **Before `/gsd:verify-work`:** full suite green + the four driven UAT rows below
- **Max feedback latency:** ~90 s per task; ~6 min per wave

⚠ **A red gate is triaged, never re-capped.** Capture failing filenames from the gate's own persisted JSON BEFORE re-running anything, check each against `git diff --numstat <base> HEAD`, and only then judge. Two of `SEED-171`'s five flaky suites — `WorkflowRunPage.test.tsx` and `WorkflowBuilderPage.canvas.test.tsx` — are primary suites of this phase's canvas and run-surface plans.

---

## Per-Task Verification Map

Filled by the planner; one row per task. The skeleton below fixes the columns and the per-success-criterion command each plan family must land on.

| Plan | SC | Behaviour | Test Type | Automated Command | File Exists |
|---|---|---|---|---|---|
| checklist | SC#1 | every in-scope screen reports `N/N` atoms or names the miss | document + per-screen negative fence | `npx vitest run src/components/workflows/<screen>.test.tsx` | ❌ W0 |
| wire slice | SC#2 | `started_at`/`completed_at` written at all **seven** sites | unit + route TestClient | `pytest tests/test_workflow_phase_cancel.py tests/test_l01_finish_run_terminal_guard.py tests/test_188_workflow_run_read.py -q` | ⚠ partial |
| wire slice | SC#3 | a count only where the type declared one; never `0`, never a dash | unit table test (7 rows) | `pytest tests/test_harness_engine.py -q` | ❌ W0 |
| human gate | SC#4 | unanswered `llm_human_input` pauses and never approves | unit + **manual UAT** | `pytest tests/test_200_human_gate_pause.py -q` | ❌ W0 |
| all | SC#5 | gates hold; the extraction changes no behaviour | gate + characterization pin | count gate · `pytest tests/unit -q` · `tsc -p tsconfig.app.json --noEmit` | ⚠ partial |

---

## Wave 0 Requirements

- [ ] `backend/tests/test_migration_121.py` — columns exist, are nullable, and **no row was backfilled** (a negative control). Copy `test_migration_119.py`'s clean-skip shape. ⚠ **hits real Postgres `:54322` — this plan MUST be dispatched ALONE** (CLAUDE.md parallel-execution rule 4).
- [ ] **A characterization pin on `phase_types.py`'s human-input executor, committed BEFORE the D-13 cut.** 188.1's most expensive lesson, re-proved four times: *"a baseline taken after the edit proves the edit against itself."*
- [ ] `_FakeQuery.select` projection fix in `test_188_workflow_run_read.py` (`:121` is `def select(self, *_columns): return self` — a **no-op that discards its column list**), plus a positive control asserting an **unselected** key is ABSENT.
- [ ] A per-executor count table test — **seven** rows (there are seven phase types, not eight), three asserting **no key emitted at all**, and one asserting a real `count: 0` IS emitted where zero is a fact.
- [ ] `backend/tests/test_200_human_gate_pause.py` — timeout ⇒ run `paused`, phase still `active`, prompt NOT expired, `finish_run` never called, thread anchor intact.
- [ ] Per-screen `MUST NOT RENDER` fences (four), each with a **planted-violation positive control that goes red**. ⚠ `199-03`'s measured lesson: a `?raw` source regex AND a `queryAllByRole("button")` filter both passed GREEN against a live planted violation — only a role-SET scan went red. Author the fence to be falsifiable.
- [ ] Pin every new leaf (`receiptVocabulary.ts`, any disclosure leaf, a `ThemeProvider`) in `scripts/vitest-count-gate.cjs` **in the same commit that creates it**.
- [ ] De-slack `PhaseSpineGraph.test.tsx` (pinned 20, running ~24) and add a pin for `phaseStatusMeta.ts` (currently **unpinned** while being the natural home for D-06's arms).

---

## Manual-Only Verifications

| Behaviour | SC | Why manual | Test instructions |
|---|---|---|---|
| Elapsed reading survives navigation | SC#2 / `BUG-260610-01` | needs a live run + a real route change | start a workflow, navigate away and back — the elapsed **continues**, never restarts |
| Canvas follows light mode on **both** surfaces | `BUG-260813-01` | needs a real theme toggle; a forked `useTheme` passes on first load and fails here | toggle light mode with the canvas open on the builder AND the run page; toggling in `ChatLayout` must re-render the canvas |
| Answer-after-pause resumes **without a restart** | SC#4 / D-10 | no automated path drives Redis pub/sub + a re-drive | start a run with an `llm_human_input` step, walk away past 300 s, return and answer — the run reads `paused`, the prompt is still answerable, answering resumes it |
| Prototype-key slug is inert on the canvas | `BUG-260807-01` + `BUG-260808-01` | needs a seeded fixture + a computed style read | seed a `workflow_definitions` row whose middle phase is slugged `constructor`; read `node.style.transform` and the affordance's computed transform with the slug swung both ways — flips **both** reports |

### UAT scoreboard axes (CLAUDE.md recipe — all four fire)

| Axis | Row shape |
|---|---|
| **Cross-provider — full native roster + OpenRouter, 8 rows** | `_exec_llm_agent` / `_exec_llm_batch_agents` / `_exec_llm_emit` all gain a declared count and emission differs by `emit_tier`. **Derive the roster from `MODEL_CAPABILITIES` by grouping on `provider`** (newest per group, registry-backed ids only) — never re-type it. A blocked provider is ⛔ **with its reason and blocking id**, never omitted. Drive each row with a per-request `model` + `provider` on `POST /threads/{id}/messages`; read verdicts from `workflow_runs` / `workflow_phases` / `harness_audit`. No global setting mutated. |
| **Multi-tool** | one `llm_agent` step using `search_documents` **+** `execute_code` — the declared count must be the retrieval fact, not the tool count |
| **Parallel-thread** | Thread A streaming a workflow while Thread B accepts a new prompt — A's per-step tick must not reseed |
| **Long-message** | ≥ 50 prior messages OR a ≥ 5 KB kickoff — the panel timeline and the run page must agree on durations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
