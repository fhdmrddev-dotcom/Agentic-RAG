---
phase: 32
slug: suggested-follow-up-questions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend framework** | Vitest + @testing-library/react |
| **Backend framework** | pytest |
| **Frontend config** | `frontend/vite.config.ts` (vitest section) |
| **Backend config** | `backend/pytest.ini` or `pyproject.toml` |
| **Frontend quick run** | `cd frontend && npm test -- --run src/__tests__/components/SuggestionPills.test.tsx` |
| **Backend quick run** | `cd backend && python -m pytest tests/unit/test_suggestions.py -x -q` |
| **Full suite command** | `cd frontend && npm test -- --run` + `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run frontend quick run + backend quick run
- **After every plan wave:** Run full frontend + backend unit suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 0 | SUG-01, SUG-02 | unit | `npm test -- --run src/__tests__/components/SuggestionPills.test.tsx` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 0 | SUG-03, SUG-04 | unit | `python -m pytest tests/unit/test_suggestions.py -x -q` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | SUG-03, SUG-04 | unit | `python -m pytest tests/unit/test_suggestions.py -x -q` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | SUG-03 | unit | `python -m pytest tests/unit/test_suggestions.py -x -q` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 2 | SUG-01, SUG-02 | unit | `npm test -- --run src/__tests__/components/SuggestionPills.test.tsx` | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 2 | SUG-01, SUG-04 | unit | `npm test -- --run src/__tests__/components/SuggestionPills.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/components/SuggestionPills.test.tsx` — stubs for SUG-01, SUG-02 (renders pills, handles click)
- [ ] `backend/tests/unit/test_suggestions.py` — stubs for SUG-03, SUG-04 (`_generate_suggestions` unit, stream failure isolation)

*Wave 0 creates test file stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pills fade in within 2s of response completing | SUG-03 | Timing requires visual/browser observation | Send a chat message; verify pills appear with fade animation within 2 seconds of last text character |
| Clicking a pill submits the question | SUG-02 | Requires live browser interaction | Click a suggestion pill; verify the chat input is populated and the message is sent automatically |
| Suggestions absent in Explorer mode | SUG-04 | Requires mode-switch + browser observation | Switch to Explorer mode; send a message; verify no pills appear |
| No suggestions after hard backend failure | SUG-04 | Requires simulating backend error | Temporarily break `_generate_suggestions`; verify main response still completes cleanly with no pills |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
