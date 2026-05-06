---
phase: 067
slug: frontend-streaming-ux-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 067 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This template will be filled by the planner from `067-RESEARCH.md` `## Validation Architecture` and per-plan `<verify>` blocks. Until then, the table rows below are placeholders.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | vitest 4.1.0 (now functional — Phase 063.1 carry-forward resolved) |
| **Framework (backend)** | pytest 7.x via `backend/venv` |
| **Config file (frontend)** | `frontend/vitest.config.ts` |
| **Config file (backend)** | `backend/pytest.ini` / `backend/pyproject.toml` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run --reporter=dot --bail=1` |
| **Quick run command (backend)** | `cd backend && source venv/bin/activate && pytest -x -q` |
| **Full suite command (frontend)** | `cd frontend && npx vitest run && npx tsc --noEmit` |
| **Full suite command (backend)** | `cd backend && source venv/bin/activate && pytest` |
| **Live verification (REQUIRED — D-067-07)** | Chrome DevTools MCP + Supabase MCP + LangSmith MCP — non-substitutable |
| **Estimated runtime** | ~30s frontend + ~60s backend; live UAT ~10–15 min |

---

## Sampling Rate

- **After every task commit:** Run language-appropriate quick suite (`vitest run --bail=1` or `pytest -x -q`).
- **After every plan wave:** Run full suite + `tsc --noEmit` (frontend) and full pytest (backend).
- **Before `/gsd-verify-work`:** Full suite green AND Chrome MCP live UAT green per D-067-07.
- **Max feedback latency:** ≤ 90s for unit/integration; ≤ 15 min including live UAT.

---

## Per-Task Verification Map

> Filled by planner during PLAN.md generation. One row per task, with explicit acceptance grep, automated command, and live-tool selector/query/trace anchor where D-067-07 applies.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Live-Tool Check | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------------|--------|
| 067-01-* | 01 | 1 | STREAM-04-polish (UX-067-01,02) | — | terminal-flip guarded — no late-message stomp on thread switch | unit + e2e | `npx vitest run useMessages` + Chrome MCP | DOM: `data-testid="message-streaming"` paints within 1s of submit | ⬜ pending |
| 067-02-* | 02 | 2 | STREAM-04-polish (UX-067-05) | — | divider renders only when iteration boundary detected | unit + e2e | `npx vitest run ToolCallPanel` + Chrome MCP | DOM: `[data-testid="iteration-divider"]` visible on multi-iteration prompt | ⬜ pending |
| 067-03-* | 03 | 1 | STREAM-04-polish (UX-067-04) | — | xread cancellation logs INFO, no traceback | unit + log-grep | `pytest backend/tests/api/test_runs_cancellation.py` | Backend log: `redis.exceptions.TimeoutError` traceback ABSENT after Chrome MCP refresh test | ⬜ pending |
| 067-04-* | 04 | 1 | STREAM-04-polish (D-067-06) | — | env var removed; Pydantic still loads | grep + start-test | `grep -r RUN_HARD_TIMEOUT_SECONDS` returns 0 + backend boots | n/a (pure cleanup) | ⬜ pending |
| 067-05-* | 05 | 3 | STREAM-04-polish (D-067-05, SC#6 closure) | — | timed_out banner + Resume click + LangSmith clean | live UAT | n/a (live-only) | Chrome MCP: banner text "Agent reached time limit" visible; Supabase: `runs.status='timed_out'`; LangSmith: trace shows clean `TimeoutError`, no `GeneratorExit` column | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/hooks/__tests__/useMessages.test.ts` — extend if missing for guarded terminal-flip
- [ ] `frontend/src/components/chat/__tests__/ToolCallPanel.test.tsx` — divider rendering test
- [ ] `backend/tests/api/test_runs_cancellation.py` — xread cancellation log assertion (planner adds if missing)

*If existing infrastructure covers all phase requirements, planner replaces this list with: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time first-paint visual feel matches Claude/ChatGPT | UX-067-01 | UX feel is subjective — automated DOM checks confirm presence/absence but not perceived smoothness | Submit Gap-006 prompt at http://localhost:5173/ as `fhdmrd@gmail.com` / `123456`; observe first-paint within 1s; confirm progressive token render. Chrome MCP screenshot at t=0, t=1s, t=5s. |
| Step N divider visual match to Aether Intelligence chrome | UX-067-05 | Design judgment — gradient/spacing/font weight require eyeball | Submit a multi-iteration prompt (e.g., `execute_code → PNGs → execute_code → PNGs+DOCX`); confirm Step 2/Step 3 dividers render with subtle gradient matching existing chat-surface treatment. |
| LangSmith trace clean closure on timed_out | SC#6 (D-067-05) | LangSmith trace UI inspection — no programmatic equivalent | After timed_out run completes, open run in LangSmith MCP; verify `TimeoutError` exception column is clean, NO `GeneratorExit` row at `run_helpers.py:1680`. |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or live-tool check or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (live UAT plan 05 is end-of-phase, not interleaved)
- [ ] Wave 0 covers all MISSING test stub references
- [ ] No watch-mode flags (CI runs are `vitest run`, not `vitest`)
- [ ] Feedback latency < 90s for unit; live UAT slot reserved for plan 05
- [ ] D-067-07 live-tool checks cited per success criterion
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task verification map

**Approval:** pending — to be set by planner during PLAN.md generation
