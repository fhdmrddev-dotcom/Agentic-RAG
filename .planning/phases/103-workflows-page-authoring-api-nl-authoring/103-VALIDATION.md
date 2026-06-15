---
phase: 103
slug: workflows-page-authoring-api-nl-authoring
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-14
validated: 2026-06-14
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
| 01-T1 | 103-01 | 1 | WFAUTH-01 (REQ-3) | T-103-01-04 | additive PhaseSpec.name (pre-103 validates; zero migration) | unit | `pytest tests/unit/test_103_phasespec_name.py -x` | ✅ | ✅ green |
| 01-T2 | 103-01 | 1 | WFAUTH-01 (REQ-1, REQ-7) | T-103-01-01, -06 | owner-scoped draft CRUD fns + Tweak-fork v(N+1) INSERT | unit (live :54322) | `pytest tests/unit/test_103_draft_crud.py tests/unit/test_103_tweak_fork.py -x` | ✅ | ✅ green |
| 01-T3 | 103-01 | 1 | WFAUTH-01 (REQ-1) | T-103-01-02, -03, -05 | draft routes + 23514→409 + status forced server-side + lint-block | unit (live :54322) | `pytest tests/unit/test_103_draft_crud.py tests/unit/test_103_published_409.py tests/unit/test_103_lint_block.py -x` | ✅ | ✅ green |
| 02-T1 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-07 | additive strict override on forced_emit (default byte-identical) | unit | `pytest tests/unit/test_103_forced_emit_strict.py -x` | ✅ | ✅ green |
| 02-T2 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-01..06 | generate→validate→retry-once→grounding-fidelity (no agent loop) | unit (mock forced_emit) | `pytest tests/unit/test_103_nl_generate.py tests/unit/test_103_grounding_fidelity.py -x` | ✅ | ✅ green |
| 02-T3 | 103-02 | 2 | WFAUTH-02 (REQ-2) | T-103-02-05 | POST /workflows/generate route (delegation; never persists) | unit | `pytest tests/unit/test_103_nl_generate.py -x` | ✅ | ✅ green |
| 03-T1 | 103-03 | 2 | WFAUTH-04 (REQ-7) | — | ActiveView + shared NAV_ITEMS + AppDock deletion (no router) | typecheck + grep | `cd frontend && npx tsc -b && grep -rn "react-router" src` | ✅ | ✅ green¹ |
| 03-T2 | 103-03 | 2 | WFAUTH-04 (REQ-7) | T-103-03-02 | deriveTier() client-derived; toggle changes badge no round-trip | frontend unit | `npx vitest run src/components/workflows/deriveTier.test.ts` | ✅ | ✅ green |
| 03-T3 | 103-03 | 2 | WFAUTH-01 (REQ-6, REQ-1) | T-103-03-01, -04 | publishWorkflow 4 distinct HTTP outcomes; CRUD client + typed 409 | frontend unit | `npx vitest run src/lib/api.workflows.test.ts` | ✅ | ✅ green |
| 04-T1 | 103-04 | 3 | WFAUTH-03 (REQ-4) | T-103-04-02 | read-only graph: phase_index order + dashed skip + drag-free static | frontend unit | `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx` | ✅ | ✅ green |
| 04-T2 | 103-04 | 3 | WFAUTH-01 (REQ-5) | T-103-04-04 | 400px push panel + 6 phase_type forms; integrity_policy greyed only on llm_emit | frontend unit | `npx vitest run src/components/workflows/PhaseFormPanel.test.tsx` | ✅ | ✅ green |
| 04-T3 | 103-04 | 3 | WFAUTH-01/02 (REQ-5) | T-103-04-01 | empty Builder DOM = describe+hint+disabled; single state transition | frontend unit | `npx vitest run src/pages/WorkflowBuilderPage.test.tsx` | ✅ | ✅ green |
| 05-T1 | 103-05 | 3 | WFAUTH-01 (REQ-6) | T-103-05-01..04 | PublishVerdict verbatim + key-detection + judge hard wall + 4 HTTP | frontend unit | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ | ✅ green |
| 06-T1 | 103-06 | 3 | WFAUTH-04 (REQ-7) | T-103-06-02, -06 | filter rail ?project_folder_id= + drafts-above-published + no-Run-on-draft + client tier | frontend unit | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ✅ | ✅ green |
| 06-T2 | 103-06 | 3 | WFAUTH-04 (REQ-7) | T-103-06-01, -03, -04, -05 | Run = real server-side kickoff + switch to Chat; Tweak v(N+1) INSERT; workflows render branch | frontend unit + tsc | `npx vitest run src/pages/WorkflowsPage.test.tsx && npx tsc -b` | ✅ | ✅ green¹ |
| Deep | — | gate | Constraint | — | Deep byte-identical: threads.py/anthropic_service.py unchanged | static (git diff) + 1 manual UAT | `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` | n/a | ✅ green² |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> ¹ **03-T1 / 06-T2 `tsc -b` caveat:** the 103-specific assertion (`grep -rn "react-router" src` → empty; `ActiveView`/`NAV_ITEMS` present in `App.tsx`/`ChatLayout.tsx`/`NavPanel.tsx`/`nav-items.ts`; `AppDock.tsx` deleted) is GREEN. `npx tsc -b` over the whole tree still surfaces errors, but ALL are in PRE-103 files — `SkillFormDialog.tsx`, `lib/api.test.ts`, `SettingsPage.tsx`, `StreamsProvider.tsx` (unused-var), `streamsStore.ts` — i.e. the known frontend typecheck/vitest rot (SEED-056 / `project_frontend_vitest_rot`), NOT a 103 regression. Zero 103-authored file (`PhaseSpineGraph`/`PhaseFormPanel`/`WorkflowBuilderPage`/`PublishGauntlet`/`WorkflowsPage`/`deriveTier`/`api.workflows`/nav files) appears in the tsc error set.
> ² **Deep gate:** `git diff a131f05a -- backend/app/api/threads.py backend/app/services/anthropic_service.py` → EMPTY (byte-identical). The 1 manual Deep-streaming UAT row stays in Manual-Only (exercised at `/gsd:verify-work 103`).

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

## SC#10 4-Axis Cross-Provider NL-Gen Matrix (MANDATORY — authored here, not in PLAN.md)

Per CLAUDE.md: REQ-2 calls a provider via forced structured generation, so VALIDATION rows are REQUIRED across the full native roster — one representative per axis, with reasoning-native AND tool-sensitive BOTH covered (not OpenAI-only). Exercised live at `/gsd:verify-work 103`.

| Axis | Required coverage for 103 | Representative + watch-for | Pass condition |
|------|---------------------------|---------------------------|----------------|
| Cross-provider | OpenAI, Anthropic, Google, OpenRouter (+ name the full native-7: DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax) | Anthropic (`claude-opus-4-8`) = product default. **OpenAI/DeepSeek: assert NO strict-mode 400 (Pitfall 1).** **DeepSeek/Moonshot (reasoning-native): thinking-OFF on the forced path / coerce-tier honest verdict (Pitfall 4).** **GLM/MiniMax (tool-sensitive): exact registry case (Pitfall 3); MiniMax-M3 passes OR documented (`minimax-m3-invalid-tool-args-400`, Pitfall 2).** | NL-gen produces a `model_validate()`-passing GROUNDED draft; no silent tool-drop; `attempt`=1 on valid |
| Multi-tool | ≥1 row whose generated draft composes ≥2 phase types using ≥2 distinct `available_tools` from the registry | grounding fidelity: every `available_tools`/`skill_ref` ∈ the real registry | UUIDs ⊆ bound subtree; tools/skills ∈ registry |
| Parallel-thread | ≥1 row: Builder generating in one view while a separate Chat thread streams | NL-gen never touches the streaming/Deep path; no cross-talk | Both keep correct mode; Deep byte-identical |
| Long-message | ≥1 row: a verbose multi-paragraph describe prompt (≥5 KB) yielding a multi-phase draft | no truncation (`is_truncated` false); `max_tokens` sized for a large `WorkflowDefinition` | Definition validates; retry semantics unchanged |

---

## Manual-Only / Lived-Experience Verifications (G-4)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-state-transition draft reveal (one DOM batch, no per-node animation/stagger) | REQ-5 | Lived-experience visual contract — wire/snapshot insufficient | Describe a workflow; observe "Composing…"→full-graph reveal in ONE commit (no stagger/incremental append) |
| 400px panel pushes (not overlays) the graph; bottom-sheet <768px | REQ-5 | Layout geometry across viewport widths | Open a node form at ≥1100px (column shrinks, no h-scroll) and at <768px (bottom-sheet) |
| Read-only graph offers no drag/handle/add-node | REQ-4 | Behavioral backstop beyond static check | Synthetic pointer drag on a node → zero change to phase_index/edges |
| Judge block is a hard wall — no override | REQ-6 | Negative-space UI assertion | Force a judge block; per-criterion rows + struck-through "publish anyway" + only "Fix & re-publish" |
| Run lands in Chat | REQ-7 | Cross-surface navigation | Run never leaves you on the Workflows page; the thread enters harness mode |
| Deep chat byte-identical post-merge | Constraint | Cross-cutting regression | One Deep-mode (non-workflow) streaming chat row passes unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — no MISSING references remain (all 8 backend + 7 frontend test files exist and pass)
- [x] No watch-mode flags
- [x] Feedback latency < 90s (backend 25 tests ~1.1 s; frontend 100 tests ~11 s)
- [ ] SC#10 4-axis rows exercised at verification (one representative per axis; reasoning-native + tool-sensitive both covered) — *authored above; exercised live at `/gsd:verify-work 103`, NOT in this Nyquist audit*
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist-compliant (2026-06-14) — every WFAUTH requirement has passing automated coverage; remaining unchecked items are the live SC#10 rows + 6 G-4 manual items, both deliberately deferred to verify-work.

---

## Validation Audit 2026-06-14

Re-ran the full Per-Task Verification Map against the executed/reviewed/secured codebase (planner had left all rows `⬜ pending / ❌ W0` at planning time).

| Metric | Count |
|--------|-------|
| Map rows audited | 16 (14 unit/static + 03-T1 gate + Deep gate) |
| Backend test files (green) | 8 / 8 — **25 tests passed** (`~1.1 s`) |
| Frontend test files (green) | 7 / 7 — **100 tests passed** (`~11 s`) |
| Gaps found (MISSING/PARTIAL) | 0 |
| Resolved by auditor | 0 (no auditor spawn needed) |
| Escalated | 0 |
| `nyquist_compliant` | **true** (unchanged) |

**Verbatim run evidence:**
- Backend: `venv/Scripts/python -m pytest tests/unit/test_103_*.py -q` → `25 passed, 1 warning in 1.11s`
- Frontend: `npx vitest run <7 × 103 test files>` → `Test Files 7 passed (7) · Tests 100 passed (100)`
- 03-T1 gate: `grep -rn "react-router" src` → empty; `ActiveView`/`NAV_ITEMS` present; `AppDock.tsx` deleted
- Deep gate: `git diff a131f05a -- threads.py anthropic_service.py` → empty (byte-identical)
- `tsc -b` rot (pre-103, out of scope) documented in footnote ¹

No `gsd-nyquist-auditor` spawn: workflow Step 3 — "No gaps → skip to Step 6, set `nyquist_compliant: true`." Frontmatter `status` → `validated`, `wave_0_complete` → `true`.
