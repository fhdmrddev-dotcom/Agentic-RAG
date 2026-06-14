---
phase: 103
slug: workflows-page-authoring-api-nl-authoring
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed strategy in `103-RESEARCH.md` → `## Validation Architecture`. The SC#10 4-axis
> cross-provider NL-gen rows are authored here (VALIDATION.md), NOT as PLAN.md tasks (CLAUDE.md).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ && cd ../frontend && npm run test` |
| **Estimated runtime** | ~90 seconds |

> NOTE: frontend vitest has ~14-17 pre-existing rot tests (fail at baseline AND HEAD) — prove net-new
> via baseline checkout, not raw count (SEED-056 / project_frontend_vitest_rot). Playwright E2E is rotted
> (SEED-049) — not a passing backstop.

---

## Sampling Rate

- **After every task commit:** Run quick command (scoped to the touched module where possible)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (modulo documented pre-existing rot)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Populated by the planner during planning — every plan task maps to a row with its requirement,
threat ref, test type, and automated command. Seeded from `103-RESEARCH.md` → `## Validation Architecture`.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 103-01 | 1 | WFAUTH-01 (REQ-3) | T-103-01-04 | additive PhaseSpec.name (pre-103 validates; zero migration) | unit | `pytest tests/unit/test_103_phasespec_name.py -x` | ❌ W0 | ⬜ pending |
| 01-T2 | 103-01 | 1 | WFAUTH-01 (REQ-1, REQ-7) | T-103-01-01, -06 | owner-scoped draft CRUD fns + Tweak-fork v(N+1) INSERT | unit (live :54322) | `pytest tests/unit/test_103_draft_crud.py tests/unit/test_103_tweak_fork.py -x` | ❌ W0 | ⬜ pending |
| 01-T3 | 103-01 | 1 | WFAUTH-01 (REQ-1) | T-103-01-02, -03, -05 | draft routes + 23514→409 + status forced server-side + lint-block | unit (live :54322) | `pytest tests/unit/test_103_draft_crud.py tests/unit/test_103_published_409.py tests/unit/test_103_lint_block.py -x` | ❌ W0 | ⬜ pending |
| 02-T1 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-07 | additive strict override on forced_emit (default byte-identical) | unit | `pytest tests/unit/test_103_forced_emit_strict.py -x` | ❌ W0 | ⬜ pending |
| 02-T2 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-01..06 | generate→validate→retry-once→grounding-fidelity (no agent loop) | unit (mock forced_emit) | `pytest tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py -x` | ❌ W0 | ⬜ pending |
| 02-T3 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-05 | POST /workflows/generate route (delegation; never persists) | unit | `pytest tests/unit/test_103_nl_generate.py -x` | ❌ W0 | ⬜ pending |
| 03-T1 | 103-03 | 2 | WFAUTH-04 (REQ-7) | — | ActiveView + shared NAV_ITEMS + AppDock deletion (no router) | typecheck + grep | `cd frontend && npx tsc -b && grep -rn "react-router" src` | ❌ W0 | ⬜ pending |
| 03-T2 | 103-03 | 2 | WFAUTH-04 (REQ-7) | T-103-03-02 | deriveTier() client-derived; toggle changes badge no round-trip | frontend unit | `npx vitest run src/components/workflows/deriveTier.test.ts` | ❌ W0 | ⬜ pending |
| 03-T3 | 103-03 | 2 | WFAUTH-01 (REQ-6, REQ-1) | T-103-03-01, -04 | publishWorkflow 4 distinct HTTP outcomes; CRUD client + typed 409 | frontend unit | `npx vitest run src/lib/api.workflows.test.ts` | ❌ W0 | ⬜ pending |
| 04-T1 | 103-04 | 3 | WFAUTH-03 (REQ-4) | T-103-04-02 | read-only graph: phase_index order + dashed skip + drag-free static | frontend unit | `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx` | ❌ W0 | ⬜ pending |
| 04-T2 | 103-04 | 3 | WFAUTH-01 (REQ-5) | T-103-04-04 | 400px push panel + 6 phase_type forms; integrity_policy greyed only on llm_emit | frontend unit | `npx vitest run src/components/workflows/PhaseFormPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 04-T3 | 103-04 | 3 | WFAUTH-01/02 (REQ-5) | T-103-04-01 | empty Builder DOM = describe+hint+disabled; single state transition | frontend unit | `npx vitest run src/pages/WorkflowBuilderPage.test.tsx` | ❌ W0 | ⬜ pending |
| 05-T1 | 103-05 | 3 | WFAUTH-01 (REQ-6) | T-103-05-01..04 | PublishVerdict verbatim + key-detection + judge hard wall + 4 HTTP | frontend unit | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ❌ W0 | ⬜ pending |
| 06-T1 | 103-06 | 3 | WFAUTH-04 (REQ-7) | T-103-06-02, -06 | filter rail ?project_folder_id= + drafts-above-published + no-Run-on-draft + client tier | frontend unit | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 06-T2 | 103-06 | 3 | WFAUTH-04 (REQ-7) | T-103-06-01, -03, -04, -05 | Run = real server-side kickoff + switch to Chat; Tweak v(N+1) INSERT; workflows render branch | frontend unit + tsc | `npx vitest run src/pages/WorkflowsPage.test.tsx && npx tsc -b` | ❌ W0 | ⬜ pending |
| Deep | — | gate | Constraint | — | Deep byte-identical: threads.py/anthropic_service.py unchanged | static (git diff) + 1 manual UAT | `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Wave-0 RED test files are authored by Plan 01 Task 1 (the 8 backend `test_103_*.py`) + the per-plan
> frontend test files (each frontend plan ships its own `*.test.tsx`/`*.test.ts` in its tasks — the
> frontend Wave-0 is distributed into the owning plans, not a single scaffolding task, because each
> frontend component is built TDD-style with its test in the same plan).

---

## Wave 0 Requirements

*Confirmed/refined by the planner.*

- [x] Backend test stubs for REQ-1 (draft CRUD round-trip + 409-on-published + lint-block), REQ-2 (model_validate pass, exactly-once retry / `nl_generation_attempt` count, grounding-fidelity ⊆-check), REQ-3 (additive-optional `PhaseSpec.name` round-trip + pre-103 def validates) — **authored by Plan 01 Task 1** (the 8 `test_103_*.py` files; Plan 02 fills the NL-gen + grounding stubs).
- [x] Frontend test stubs for REQ-4 (drag-free static DOM assertion), REQ-7 (`deriveTier()` no-round-trip) — **distributed into the owning frontend plans** (Plan 03 deriveTier/api; Plan 04 graph/panel/builder; Plan 05 gauntlet; Plan 06 page) — each frontend component ships its test in the same TDD task.
- [x] Shared fixtures: an owner-scoped draft, a second-user draft (RLS), a published row (immutability/409), a pre-103 definition lacking `phase.name` — **created live against :54322 in the Plan 01 backend tests** (seed + rollback, the 102 `test_publish_flip` precedent); the frontend tests mock the api client (no live DB).

*Backend Wave-0 lives in Plan 01 Task 1 (8 files, xfail until filled by Plans 01/02). Frontend Wave-0 is per-plan (TDD: test ships with the component). `wave_0_complete` flips true once Plan 01 Task 1 lands.*

---
