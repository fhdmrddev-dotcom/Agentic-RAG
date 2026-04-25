---
phase: 49
milestone: v2.4
---

# Phase 49: Library Health Redesign — Context

**Date:** 2026-04-25
**Status:** Ready for execution

## User Feedback Driving This Redesign

During the Phase 47 close-out discussion, the user raised critical concerns about the current Library Health dashboard:

### 1. Scale Problem
> "How will we handle 100k files? This is not practical."

**Problem:** Current backend loads 500 docs + 5000 audit rows into Python memory for "never retrieved" calculation. Top-10 lists are meaningless at scale.
**Solution:** SQL-level pagination, aggregate overview endpoint, no in-memory set differences.

### 2. Low Confidence Misconception
> "Do you think it's normal to have low confidence scores in RAG applications? ... lower confidence does not mean I have a problem with the document itself but rather the context of the question."

**Problem:** Current dashboard flags "low confidence documents" — but confidence is query-dependent, not a document quality metric.
**Solution:** Two-tab low confidence panel: "By Document" (backward compat) and "By Query" (shows which queries triggered low confidence, with suggested actions).

### 3. Empty State Messaging
> "'No downvoted documents' — maybe this is not practical"

**Problem:** Passive/negative empty states ("No X found") describe absence rather than celebrating good health.
**Solution:** Positive, actionable messaging: "All clear — no negative feedback," "Great coverage — every document retrieved."

### 4. Chart Types
> "Document usage is now bar chart ... we should diversify the chart types and show real professional dashboard"

**Problem:** Single horizontal bar chart of top 10 filenames tells no story and doesn't scale.
**Solution:** Multiple chart types: gauge (health score), line chart (retrieval trend over time), area chart (coverage %), gauge (feedback rate).

### 5. Health Score
> "Yes" (to single 0-100 health score)

**Solution:** Weighted formula combining coverage (40%), freshness (30%), confidence (20%), feedback (10%).

## User Decisions

| Question | User Answer | Implication |
|----------|-------------|-------------|
| Low confidence: documents or queries? | **Both** (separate tabs) | Two-tab design in Low Confidence panel |
| Scale target? | Industry standard, simplify if complex | SQL pagination, pragmatic aggregation |
| Chart library? | Any, as long as professional | Use recharts (already installed) |
| Folder coverage breakdown? | **Skip for now** | Not in this phase |
| Health score? | **Yes** | New /overview endpoint with 0-100 score |

## Phase Scope

**In scope:**
- Backend: Paginated endpoints, overview/health score, query-level low confidence, retrieval trend
- Frontend: Dashboard redesign with gauge, line chart, tabbed panels, pagination, positive empty states
- Feedback panel: Gauge chart + positive messaging

**Out of scope (deferred):**
- Folder-level breakdowns (user explicitly said skip)
- Real-time updates (not mentioned as requirement)
- Advanced analytics (click-through, retention) — beyond v2.4

## Plan Files

| Plan | File | Description |
|------|------|-------------|
| 49-01 | `.opencode/plans/49-01-backend-health-refactor.md` | Backend pagination, aggregates, health score |
| 49-02 | `.opencode/plans/49-02-frontend-health-redesign.md` | Frontend dashboard redesign with charts |

## Requirements Mapping

| Requirement | Plan | Description |
|-------------|------|-------------|
| HLTH-01 | 49-01 + 49-02 | Pagination instead of fixed top-10 |
| HLTH-02 | 49-01 + 49-02 | Low confidence explains query-document relevance |
| HLTH-03 | 49-02 | Feedback empty states with positive messaging |
| HLTH-04 | 49-01 | API accepts pagination params, returns total counts |

## Dependencies

- **Wave 1 (Backend):** Must complete before Wave 2 (Frontend)
- **External:** No new DB migrations needed (uses existing tables)
- **Libraries:** No new npm/pip packages (uses recharts, already installed)
