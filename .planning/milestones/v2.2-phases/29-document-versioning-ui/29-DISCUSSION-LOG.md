# Phase 29: Document Versioning — UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-12
**Mode:** Claude's Discretion (user delegated all decisions)

## Gray Areas Identified

1. Document list filtering — API returns all rows including old versions
2. Version badge design — placement and prominence (VER-03)
3. History panel UX — inline expand vs modal (VER-04)
4. Restore action — mechanism and confirmation flow (VER-05)

## User Input

> "you decide"

All four gray areas were decided by Claude based on existing codebase patterns.

## Decisions Made

| Area | Decision | Rationale |
|------|----------|-----------|
| List filtering | Filter `GET /documents` to `is_latest=True`; add `GET /{id}/versions` endpoint | Keeps main list clean; versions on demand |
| Version badge | Inline chip next to filename, `vN` format, only when `version_number > 1` | Reuses topic pill style; no new column |
| History panel | Extend existing expand/collapse chevron pattern in DocumentList | Consistent interaction model; modal would be heavier |
| Restore action | `POST /{id}/restore` flag-flip endpoint + confirmation dialog | Flag-flip works because old chunks are retained from Phase 28 |
