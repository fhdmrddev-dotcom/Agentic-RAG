---
seed_id: SEED-331
title: Older-version rows stay actionable server-side (classification accept/dismiss, Add link) and the delete dialog misstates promotion
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase that edits backend/app/api/documents.py classification accept/dismiss, the relationship create path, or the older-version detail panel; or any report of a classification move landing on an old version row.
trigger_paths: ["backend/app/api/documents.py", "frontend/src/components/metadata/DocumentDetailPanel.tsx", "frontend/src/components/ingestion/DocumentRow.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["271-REVIEW.md WR-02", "271-REVIEW-FIX.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-331: Older-version rows stay actionable server-side

## The finding

Phase 271 Find can open an older version (Version = Older). The detail panel blocks metadata edits there, but
`documents.py` classification accept/dismiss (~:2085-2098) does not check `is_latest`, so accepting a suggestion moves
only the old row to another folder; Add link in the panel still acts on the old row. Separately, on an older row with
`version_number > 1` the delete dialog says "promote vN-1 as current" — false (only deleting the latest promotes); the
action is correct, the wording is not.

## Why it matters

A person can silently split a version history across folders from a read-only-looking panel. Needs a server-side
latest-only check plus read-only panel sections; the wording fix is one string.
