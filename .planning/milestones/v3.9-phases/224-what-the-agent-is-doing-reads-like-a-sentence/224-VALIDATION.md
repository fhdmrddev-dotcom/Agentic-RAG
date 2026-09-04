---
phase: 224
slug: what-the-agent-is-doing-reads-like-a-sentence
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 224 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) / vitest (frontend) |
| **Config file** | `backend/pyproject.toml` / `frontend/vite.config.ts` |
| **Quick run command** | `npx vitest run src/components/panel/__tests__/Seam.test.tsx src/components/chat/__tests__/ToolApproval.test.tsx` |
| **Full suite command** | `pytest backend/tests/test_224_approval_deadline.py && node scripts/vitest-count-gate.cjs` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + mechanical gates verified
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 224-01-01 | 01 | 1 | SEED-240 | T-224-01 | Tool phrases shared without cross-domain boundary leakage | unit | `npx vitest run src/components/workflows/__tests__/toolNames.test.ts` | ✅ | ⬜ pending |
| 224-01-02 | 01 | 1 | SEED-240 | T-224-02 | SeamCard arms deleted (Winner D), ask_user intact, remaining tests pass | unit | `npx vitest run src/components/panel/__tests__/Seam.test.tsx` | ✅ | ⬜ pending |
| 224-02-01 | 02 | 1 | BUG-260902-04 | T-224-03 | Approval deadline on wire as ISO 8601 UTC timestamp | unit | `pytest backend/tests/test_224_approval_deadline.py` | ❌ W0 | ⬜ pending |
| 224-03-01 | 03 | 2 | BUG-260902-04 | T-224-04 | ChatToolApprovalCard renders ticking countdown and handles timeout state | unit | `npx vitest run src/components/chat/__tests__/ToolApproval.test.tsx` | ✅ | ⬜ pending |
| 224-03-02 | 03 | 2 | BUG-260902-04 | T-224-05 | Pending approval card docks above composer in ChatArea | unit | `npx vitest run src/components/chat/__tests__/ToolApproval.test.tsx` | ✅ | ⬜ pending |
| 224-04-01 | 04 | 2 | SEED-240 | T-224-06 | Status line inside RunCard frame; 2-column result layout | unit | `npx vitest run src/components/chat/__tests__/StopControl.test.tsx` | ✅ | ⬜ pending |
| 224-04-02 | 04 | 2 | SEED-240 | T-224-07 | `<Square>` glyph dropped from terminal indicators in MessageItem | unit | `npx vitest run src/components/chat/__tests__/StopControl.test.tsx` | ✅ | ⬜ pending |
| 224-05-01 | 05 | 3 | BUG-260902-07 | T-224-08 | References folded by default; shared fold trigger affordance across CitationList and RunCard | unit | `npx vitest run src/components/chat/__tests__/CitationList.test.tsx` | ✅ | ⬜ pending |
| 224-05-02 | 05 | 3 | SEED-240 | T-224-09 | TodoRow wraps naturally at 308px panel floor | unit | `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` | ✅ | ⬜ pending |
| 224-05-03 | 05 | 3 | All | T-224-10 | Full mechanical gates pass (tsc baseline 66, count gate OK 188/188) | gate | `$env:GSD_VITEST_MAX_WORKERS="2"; node scripts/vitest-count-gate.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_224_approval_deadline.py` — unit test for approval pause `expires_at` wire emission

---

## Manual-Only Verifications

| Behavior | Why Manual | How to Verify |
|----------|------------|---------------|
| Above-the-fold docked card | jsdom cannot judge viewport fold | Drive in desktop browser: trigger approval in chat, verify card docks cleanly above MessageInput without obscuring input bar |
| Clock ticking feel | Visual perception of calm countdown | Watch countdown tick from 120s down in browser, verify no layout shifting |
| Todo label wrapping | Visual font rendering on 308px width | Resize panel to 308px floor with multi-line todo, verify sentence flows naturally |
