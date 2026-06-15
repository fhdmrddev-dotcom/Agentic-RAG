---
phase: 094
slug: workflow-legibility-mode-clarity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 094 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `094-RESEARCH.md → ## Validation Architecture` (every invariant maps to an EXISTING working test precedent in the repo). The detailed method per invariant lives in RESEARCH.md `INV-1..INV-5`; this file is the executor's sampling contract + the Wave 0 test-file list + the manual-only rows.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | vitest 4.1.0 + @testing-library/react 16.3.2 + vitest-axe 0.1.0 (jsdom) — all present, zero install |
| **Framework (backend)** | pytest (existing harness suite — `backend/tests/test_09*` / `test_harness_*`), run in `venv` |
| **Config file** | `frontend/vitest.config.ts` (setupFiles `./src/setupTests.ts` — axe matchers wired at setupTests.ts:6-8) |
| **Quick run command (FE)** | `cd frontend && npx vitest run src/components/panel src/providers` |
| **Full suite command (FE)** | `cd frontend && npm run test` (= `vitest run`) + `npm run build` (tsc -b) |
| **Quick run command (BE)** | `cd backend && pytest tests/test_094_*.py tests/test_harness_engine*.py -x` (in venv) |
| **Full suite command (BE)** | `cd backend && pytest tests/` (touched-surface + harness) |
| **Estimated runtime** | FE quick ~30s · FE full ~2–3min · BE touched ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run the FE quick command for the touched panel/provider dir (< 30s), or the BE quick command for the RC-4 task.
- **After every plan wave:** `cd frontend && npm run test && npm run build` + `cd backend && pytest tests/test_094_*.py tests/test_harness_engine*.py`.
- **Before `/gsd-verify-work`:** Full FE suite green + `tsc -b` clean + touched-surface BE suite green; THEN the manual SC#10 4-axis rows below (Chrome MCP, operator-owned).
- **Max feedback latency:** ~30 seconds (per-task quick run).

---

## Per-Task Verification Map

> Task IDs are pinned by the planner (`gsd-planner`). Each plan task MUST carry an `<automated>` verify command OR a Wave 0 dependency. The rows below map the 5 falsifiable invariants + the 7 IN-SCOPE decisions (D-01..D-07) to their requirement and test method; the planner attaches the concrete `{N}-{plan}-{task}` IDs.

| Invariant / Decision | Requirement | Test Type | Automated Command | File (Wave 0) | Status |
|---------------------|-------------|-----------|-------------------|---------------|--------|
| INV-1 — `phasesByThread` mutation → ZERO chat re-renders | PANEL-09 | unit (vitest, reference-identity FC#1) | `npx vitest run src/providers/__tests__/phaseHooks.test.tsx` | `src/providers/__tests__/phaseHooks.test.tsx` | ⬜ pending |
| INV-2 — WCAG 2.1 AA, zero axe violations all states + 1/N phases | A11Y-03 | unit (vitest-axe) + manual (Chrome MCP contrast) | `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx` | `src/components/panel/__tests__/PhaseTimeline.test.tsx` | ⬜ pending |
| INV-3a — RC-4 backend persists a failure message at BOTH return sites; Deep path untouched | RC-4 (audit) | backend unit (pytest) | `pytest backend/tests/test_094_rc4_failure.py -x` | `backend/tests/test_094_rc4_failure.py` | ⬜ pending |
| INV-3b — failed/gate_failed run renders failed-with-reason, never empty `done`; `reason_unknown` sentinel | RC-4 (audit) | frontend unit (vitest) | `npx vitest run src/components/panel/__tests__/FailReason.test.tsx` | `src/components/panel/__tests__/FailReason.test.tsx` | ⬜ pending |
| INV-4 — reconcile-then-live: live NEVER moves a counter backward; skeleton from `total_phases` alone | PANEL-08 | unit (vitest) | `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx` | `src/components/panel/__tests__/PhaseReconcile.test.tsx` | ⬜ pending |
| INV-5 (automatable) — per-thread timeline isolation under parallel streams | PANEL-09 / SC#10 axis-3 | unit (vitest) | `npx vitest run src/providers/__tests__/phaseHooks.test.tsx` | (same file as INV-1) | ⬜ pending |
| D-05 — `--accent-violet` in BOTH theme blocks + tailwind registration | A11Y-03 (purple contrast) | grep-verifiable + build | `grep -c "accent-violet" frontend/src/index.css` (≥2) · `grep -c "accent-violet" frontend/tailwind.config.js` (≥1) · `cd frontend && npm run build` | n/a (CSS/config) | ⬜ pending |
| D-07 — additive SSE branches; Deep dispatch byte-identical | PANEL-08/09 | unit (vitest) + grep | `npx vitest run src/providers/__tests__/phaseHooks.test.tsx` · grep Deep dispatch unchanged | (INV-1 file) | ⬜ pending |
| D-02 — mode label from `active_workflow_run_id` server truth | D-092-UX (subset) | unit (vitest) | `npx vitest run src/components/chat/__tests__/ChatArea*.test.tsx` | TBD by planner | ⬜ pending |
| D-06 — `ask.draft` renders in PendingAskCard + batch summaries | intermediate-output | unit (vitest) | `npx vitest run src/components/panel/__tests__/PendingAskCard*.test.tsx` | TBD by planner | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/providers/__tests__/phaseHooks.test.tsx` — INV-1 (PANEL-09 zero-chat-re-render reference-identity) + INV-5 (per-thread isolation) + the `phasesByThread` demux routing. Mirror `panelHooks.test.tsx` (raw SSE bytes → REAL `subscribeToRun` → REAL `makeStreamCallbacks` → store assertion).
- [ ] `src/components/panel/__tests__/PhaseTimeline.test.tsx` — INV-2 (vitest-axe, all states pending/running/done/failed/retrying, 1-phase + N-phase, both-themes structural).
- [ ] `src/components/panel/__tests__/FailReason.test.tsx` — INV-3b (frontend RC-4 render incl. `reason_unknown` sentinel, never empty red card).
- [ ] `src/components/panel/__tests__/PhaseReconcile.test.tsx` — INV-4 (reconcile-then-live, no-backward-counter, skeleton-from-total_phases).
- [ ] `backend/tests/test_094_rc4_failure.py` — INV-3a (backend persist at BOTH failure-return sites: `fail_run` ~699–709 AND `skip_to_phase` guard ~712–735; assert `_shielded_finalize` NOT in call path → Deep byte-identical).
- [ ] DATA-CONTRACT §7 fixtures as a shared replayable test module (`fx-phase-*`, `fx-run-running/-failed/-done/-askuser-paused/-gatefail-retry`) matching the exact `_emit` wire shape.
- [ ] Framework install: **NONE** — vitest + vitest-axe + testing-library all present.

---

## Manual-Only Verifications

> SC#10 4-axis bandwidth (CLAUDE.md MANDATORY "UAT scoreboard recipe"). Axes 1, 2, 4 are manual (Chrome MCP, operator-owned); axis 3 (parallel-thread) has an automatable unit form (INV-5) AND a manual live row. Both-themes real-contrast is manual (Chrome MCP / Lighthouse).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **Cross-provider** timeline + mode + RC-4 render identically | PANEL-08 / RC-4 / SC#10 axis-1 | Needs live LLM streams across 4 providers | Run a Harness workflow on OpenAI, Anthropic, Google, OpenRouter (one model each). Assert the phase timeline, mode badge, and a failed-run reason render identically — no provider-specific rendering. |
| **Multi-tool** sub-agent child rows render; counts SUPPRESSED | PANEL-08 / SC#10 axis-2 | Needs a live workflow exercising 2+ tools | Run a workflow whose `llm_agent`/`llm_batch_agents` phase uses `search_documents` + `execute_code`. Assert sub-agent child rows + per-subtopic summaries render; assert NO per-phase tool/search count chips appear (D-03 suppress). |
| **Parallel-thread** isolation (live) | PANEL-09 / SC#10 axis-3 | Needs two live threads concurrently | Thread A streams a Harness run while Thread B accepts a new prompt. Assert A's timeline is not corrupted and B's composer is unlocked (no global isStreaming lockout — the 075.3-regression-closed bonus). |
| **Long-message** timeline + draft hold | PANEL-08 / SC#10 axis-4 | Needs a ≥50-msg thread or ≥5KB prompt | Run a workflow in a thread with ≥50 prior messages OR a ≥5KB kickoff prompt. Assert the timeline + draft preview render correctly without layout/perf degradation. |
| **Both-themes real contrast** (incl. NEW `--accent-violet`) | A11Y-03 | Real rendered contrast, not jsdom | Chrome MCP renders the timeline in dark + light. Verify status/title text ≥4.5:1; `--accent-violet` graphic ≥3:1 (dark 4.35:1 / light 8.52:1) and `Attempt N` pill text ≥4.5:1 (dark 9.83:1 lightened). |
| **PANEL-08 auto-open** on entering Harness Mode | PANEL-08 | Live panel mount behavior | Enter Harness Mode / launch a workflow; assert the workspace panel auto-opens to the phase timeline (reconciled via `GET /threads/{id}/workflow` on mount). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test files + shared fixtures module)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after Wave 0 test files exist)

**Approval:** pending
