---
phase: 7
slug: explorer-sub-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini or pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | AGENT-01 | unit | `cd backend && python -m pytest tests/ -k "explorer" -x -q` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | AGENT-01 | unit | `cd backend && python -m pytest tests/ -k "explorer" -x -q` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 2 | AGENT-02 | unit | `cd backend && python -m pytest tests/ -k "explorer" -x -q` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 3 | AGENT-03 | manual | See Manual Verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_explorer.py` — stubs for AGENT-01, AGENT-02, AGENT-03
- [ ] Existing `backend/tests/conftest.py` — shared fixtures (verify covers explorer mode)

*Existing infrastructure covers most phase requirements; Wave 0 adds explorer-specific stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Explorer agent mode visible in frontend dropdown | AGENT-03 | Requires browser UI inspection | Open chat, verify agent mode selector appears in toolbar alongside model selector |
| Explorer returns synthesized answer (not raw JSON) | AGENT-01 | LLM output quality, not testable via unit test | Ask "What documents do I have about X?" and verify response is readable prose |
| "No documents found" message shown clearly | AGENT-01 | End-to-end flow with empty KB | Ask about a topic with no docs, verify graceful message not empty/error |
| Sub-agent invocation for deep analysis | AGENT-02 | Requires live KB + LLM call | Ask for detailed analysis of a specific doc, verify analyze_document tool is called |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
