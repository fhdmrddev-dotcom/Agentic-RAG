---
phase: 27
slug: citations-confidence-frontend
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-12
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run test --run` |
| **Full suite command** | `npm run test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --run`
- **After every plan wave:** Run `npm run test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|-----------|-------------------|-----------|--------|
| 27-01-00 | 01 | 0 | CITE-03 | scaffold | `npm run test -- --reporter=verbose` | `frontend/src/__tests__/components/CitationCard.test.tsx`, `frontend/src/__tests__/components/ConfidenceBadge.test.tsx` | ⬜ pending |
| 27-01-01 | 01 | 1 | CITE-03 | unit | `npm run test -- --reporter=verbose` | `frontend/src/__tests__/components/CitationCard.test.tsx` | ⬜ pending |
| 27-01-02 | 01 | 1 | CITE-03 | unit | `npm run test -- --reporter=verbose` | `frontend/src/__tests__/components/ConfidenceBadge.test.tsx` | ⬜ pending |
| 27-01-03 | 01 | 2 | CITE-03 | visual/manual | n/a | ✅ | ⬜ pending |
| 27-01-04 | 01 | 2 | CITE-03 | visual/manual | n/a | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend/src/__tests__/components/CitationCard.test.tsx` — unit tests for CitationCard expand/collapse and passage truncation
- [x] `frontend/src/__tests__/components/ConfidenceBadge.test.tsx` — unit tests for badge color tiers (green/amber/red) and disclaimer rendering

*Created by Task 0 in plan 27-01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Citation cards appear beneath AI message in live chat | CITE-03 | Requires live SSE stream + real RAG backend | Send a document-grounded query, verify collapsible cards render below response |
| Confidence badge absent on non-RAG message | CITE-03 | Requires live chat session without documents | Send a general query (no documents), verify no badge renders |
| Low-confidence disclaimer renders when badge is red | CITE-03 | Requires score < 0.5 from backend | Send query with poor document match, verify disclaimer text appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
