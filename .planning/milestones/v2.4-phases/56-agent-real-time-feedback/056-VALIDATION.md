---
phase: 56
slug: agent-real-time-feedback
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vite.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 1 | D-04 | — | SSE event scoped to authenticated user session | integration | `cd backend && python -m pytest tests/unit/test_phase56_iteration_start.py -x -q` | ❌ W0 | ⬜ pending |
| 56-02-01 | 02 | 1 | D-03/D-05/D-07/D-08 | — | N/A (UI only) | automated+manual | `cd frontend && npx tsc --noEmit && npm run build` + browser inspection | ✅ | ⬜ pending |
| 56-03-01 | 03 | 1 | D-10/D-11/D-12 | — | ingestion_step column does not leak across tenants (RLS) | integration | `cd backend && python -m pytest tests/unit/test_phase56_ingestion_step.py -x -q` | ❌ W0 | ⬜ pending |
| 56-03-02 | 03 | 1 | D-14/D-15/D-16/D-17 | — | Realtime subscription scoped to current thread only | manual | browser tab-refresh during active stream | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_phase56_iteration_start.py` — stubs for iteration_start SSE event (D-04)
- [ ] `backend/tests/unit/test_phase56_ingestion_step.py` — stubs for ingestion_step column updates (D-10/D-11)

*Existing pytest infrastructure covers other requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step counter increments in ToolCallPanel | D-03 | SSE streaming UI state, no automated harness | Open chat, send multi-tool query, verify "Step N" label increments |
| Task phase labels switch correctly | D-07 | Frontend state machine driven by active tool events | Observe label changes: "Gathering context" → "Thinking…" → "Synthesizing answer" |
| Skill row appears inline | D-08/D-09 | Ephemeral streaming state, not persisted | Trigger a skill-activating query, verify Zap icon row appears in tool sequence |
| Ingestion step badge updates | D-13 | Live Realtime event, requires active upload | Upload a document, observe badge change: Extracting → Chunking → Embedding → Extracting metadata |
| Reconnect auto-loads message | D-14/D-16 | Browser tab lifecycle, requires real disconnect | Start stream, switch tabs, return — verify message auto-loaded without refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
