---
id: BUG-260516-03
title: Reingest action exists on Library Health page but is missing from the Documents page
reported: 2026-05-16
surface: Agentic-RAG
severity: minor
status: closed
closed: 2026-05-16
closed_by: 071.4-03 (commit 4d859de)
affected_areas: [frontend/documents-list, frontend/library-health, ux/consistency]
folded_into: 071.4
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 4931443
  date: 2026-05-16
verified_fixed:
  date: 2026-05-16
  branch: v2.5-dev
  evidence: |
    Per-row Reingest button shipped on Documents page DocumentList. Verified
    via Chrome MCP: button visible on every row (RefreshCw icon, ghost
    variant, tooltip "Re-ingest document"), disabled when status is pending
    or processing, click triggers POST /documents/{id}/reingest which
    completes the round-trip with status transitions visible in real-time.
---

# BUG-260516-03: Reingest button missing from Documents page

## What we observed

Operator on the Documents page wanted to re-extract their thesis to verify the
camelot precision floor (071.4-01) effect. There is no "Reingest" / "Re-extract"
action button or menu item on the Documents list. The same action IS available
on the Library Health page next to each document row.

The user's literal observation: "there's reingest button on health dashboard
next to each file but not on documents page, or I can delete then upload again?"

The fallback they considered (delete + re-upload) is destructive — drops the
`documents.id`, breaks thread citations, loses the upload audit trail.

## Why it matters

Minor severity but it's a real friction point:

- **Documents page is the canonical landing spot** for "things I uploaded." Users
  expect to act on documents from there.
- **The reingest action lives on a secondary page** (Library Health), which is
  primarily about quality/confidence inspection — not document management.
- Without the button, users either learn the URL pattern for `/reextract`,
  paste curl, or destructively delete + re-upload. None are good options.
- The Phase 071.3 design intent (D-v2.6-04) was opt-in per-document
  re-extraction. The API exists; the UI just doesn't surface it consistently.

## Hypothesized cause

The reingest button was probably added during Phase 071.2's per-aspect dispatcher
work as a debug/admin affordance on the Library Health page, and never
propagated to the Documents page as a first-class action. No deliberate decision
to omit it — just an oversight.

## Surface classification

`Agentic-RAG` — frontend UX consistency bug. Routes per CLAUDE.md cross-check.

## Suggested routing

- **Fold into Plan 071.4-03** (documents-list realtime status) — operator
  decision 2026-05-16. Plan 03 is already touching the documents-list page
  for the realtime-status fix; adding a per-row Reingest action button is a
  natural co-deliverable. ~10-15 LOC.

## Workarounds (until Plan 03 ships)

- **Use the Library Health page's Reingest button** — same endpoint, just one
  navigation hop away.
- **API via /docs** — http://localhost:8000/docs → `POST /documents/{id}/reextract`
  → Try it out → `{}` body.

## Reference / evidence links

- Backend endpoint: `POST /documents/{id}/reextract` (per D-v2.6-04, returns
  202 + BackgroundTask).
- Library Health implementation has the button — copy the action handler from
  there as the starting point for the Documents page version.
