---
seed_id: SEED-340
title: Thumbs-up/down feedback is still collected but shown nowhere — FeedbackStatsPanel lost its only mount when Library Health was retired
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "Any phase whose files_modified names HealthTab.tsx, FeedbackStatsPanel.tsx or backend/app/api/feedback.py; OR the next Library Health / retrieval-quality phase; OR anyone asks which documents users downvote."
trigger_paths: ["frontend/src/components/health/FeedbackStatsPanel.tsx", "frontend/src/components/library/HealthTab.tsx", "backend/app/api/feedback.py", "frontend/src/lib/api/knowledge.ts"]
trigger_surfaces: ["library", "retrieval"]
migration_note:
relates_to: ["SEED-046 (Library Health enrichment)", "Phase 040 (v2.3, feedback stats)", "Phase 217.1-14 (retired Library Health page)", "docs/history/v2.3-memory-multimodal-and-experience.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-340: feedback is collected and shown nowhere

## The finding

v2.3 (Phase 040) added thumbs-up/down feedback on answers and a stats panel in Library Health that
listed feedback totals and the most-downvoted documents. Measured 2026-10-04:

- `frontend/src/components/health/FeedbackStatsPanel.tsx` exists and is imported by **no** file.
- `getFeedbackStats()` (`frontend/src/lib/api/knowledge.ts:530`) is re-exported by `lib/api.ts` and called
  by nothing.
- `GET /feedback/stats` (`backend/app/api/feedback.py:84`) still serves.
- `frontend/src/components/library/HealthTab.tsx` has no feedback reference.
- The panel lost its mount in `de05f4c36` (2026-08-30, `feat(217.1-14): retire Library Health +
  Governance nav entries`). The health content moved into the Library's Health tab; this panel did not.

So users still click thumbs, the backend still stores and aggregates them, and no one can see the result.

## Why it matters

The downvoted-documents list is the cheapest retrieval-quality signal the product has: users point
directly at documents that produce bad answers. Collecting a signal and showing it nowhere also asks
users for work that has no visible effect.

## When to surface

The next phase that edits the Library Health tab or the feedback API, or any retrieval-quality phase.

## Scope estimate

Small. Mount the existing panel (or a restyled version) in `HealthTab.tsx`, wire `getFeedbackStats`, and
check the remove-downvoted action still works. Alternative, if the operator decides feedback stats are
not wanted: delete the panel and the unused client function, and say so here.

## Breadcrumbs

- `docs/history/v2.3-memory-multimodal-and-experience.md` (status row "Feedback stats shown in Library Health: Unverified, possibly no longer displayed")
- `git log -S"FeedbackStatsPanel" -- frontend/src`: `504a49ad3` (create), `e20cf2410` (mount), `de05f4c36` (orphaned)
