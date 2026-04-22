# Phase 31: Audit Log — Settings UI - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a read-only Audit Log section to the Settings page. Three deliverables:
1. A paginated table showing the user's own audit entries (AUDIT-04)
2. Filters: preset date range buttons + action type single-select dropdown
3. Export CSV button that downloads the full filtered dataset via a dedicated endpoint (AUDIT-05)

Requires one new backend GET endpoint for list (`GET /audit-logs`) and one for export (`GET /audit-logs/export`). The `audit_log` table has INSERT-only RLS — direct Supabase JS client SELECT calls would fail, so all reads go through the FastAPI backend with JWT auth.

No changes to existing backend instrumentation (Phase 30 complete). All other SettingsPage sections are untouched.

</domain>

<decisions>
## Implementation Decisions

### Pagination — D-01
Prev/Next button navigation with "Page N of M" indicator. Backend returns a fixed page size (50 rows recommended) plus a total count. Frontend computes page count from `ceil(total / page_size)`.

```
‹ Prev   Page 1 of 4   Next ›
```

No "load more" / infinite scroll — page-based navigation was chosen for its clear sense of scale.

### Date Range Filter — D-02
Preset pill buttons: **All | 7d | 30d | 90d**. No custom date picker library. Active preset is highlighted (matches existing `bg-primary/10 text-primary` chip style). Pressing a preset changes the `since` query param sent to the backend.

### Action Type Filter — D-03
Single-select `<select>` dropdown seeded with all 8 action types + an "All types" default. Renders with the existing `ghost-border` style from SettingsPage. Filtering to one type is the dominant use case — multi-select not needed.

The 8 action types: `document.upload`, `document.delete`, `search.query`, `code.execute`, `skill.load`, `thread.create`, `thread.delete`, `settings.update`.

### Metadata Column (Details) — D-04
Per-action-type formatted one-liner — human-readable, no raw JSON exposed. Mapping:

| Action type | Details format |
|---|---|
| `document.upload` | `{filename} ({file_size formatted})` |
| `document.delete` | `{filename}` |
| `search.query` | `"{query_text}"` (truncated to ~60 chars) |
| `code.execute` | `{language}` |
| `skill.load` | `{skill_name}` |
| `thread.create` | — (no meaningful metadata) |
| `thread.delete` | — |
| `settings.update` | comma-joined changed field names (keys containing `_key`/`_secret` already redacted by Phase 30) |

### CSV Export — D-05
Export CSV downloads the **full filtered dataset** (not just the current page). A separate endpoint `GET /audit-logs/export` accepts the same filter params (`since`, `action_type`) and returns all matching rows with `Content-Disposition: attachment; filename=audit-log.csv`. Frontend triggers the download via a blob URL after fetching.

CSV columns: `timestamp`, `action_type`, `details` (same one-liner format as D-04), `metadata_json` (raw, for completeness).

### Backend API — D-06
Two new FastAPI endpoints on a new `audit` router:

- `GET /audit-logs?page=1&page_size=50&since=7d&action_type=search.query`
  Returns `{entries: [...], total: N, page: 1, page_size: 50}`

- `GET /audit-logs/export?since=7d&action_type=search.query`
  Returns CSV with `Content-Disposition: attachment`

Both endpoints use `get_current_user` dependency for auth. Query against `audit_log` table filtering `user_id = current_user.id`. Order by `created_at DESC`.

`since` param values: `7d`, `30d`, `90d`, or absent (all time).

### UI Placement — D-07
New `SectionCard` at the **bottom** of SettingsPage, below the Code Execution section. Title: "Audit Log", description: "Your account activity — all significant actions recorded for security and compliance."

Filters row sits above the table inside the card. Export CSV button sits in the card header (right side), matching the Reset/Save button placement pattern at the top of SettingsPage.

### Claude's Discretion
- Loading state: spinner replacing table content while fetching (not skeleton rows)
- Empty state: "No entries found for this period." centered in the table area
- Error state: muted error message replacing table, same pattern as SettingsPage main error
- Table styling: `<table>` with `text-sm`, column widths fixed (timestamp: 160px, action type: 160px, details: flex), `divide-y divide-border/30` row separators — matches existing SettingsPage visual language
- Timestamp display: local time, formatted as "Apr 14, 2026 10:32 AM"
- No shadcn Table component needed — a plain styled `<table>` is sufficient and keeps zero new dependencies

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Phase context
- `.planning/REQUIREMENTS.md` §AUDIT-04, AUDIT-05 — acceptance criteria for view + export
- `.planning/phases/30-audit-log-backend/30-01-PLAN.md` — audit_log schema (columns, action types, metadata shapes per type)
- `backend/app/services/audit_service.py` — VALID_ACTION_TYPES frozenset (source of truth for the 8 action type strings)
- `backend/supabase/migrations/017_audit_log.sql` — table definition and RLS policy

### Existing frontend patterns to follow
- `frontend/src/pages/SettingsPage.tsx` — SectionCard, FieldRow, ghost-border, gradient-primary button style
- `frontend/src/components/ingestion/DocumentList.tsx` — existing table-like pattern with row expand
- `frontend/src/lib/api.ts` — how API calls are made (fetch + auth header pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionCard` (SettingsPage.tsx inline component) — wraps the new Audit Log section; title + description + children pattern
- `Button` (shadcn/ui) — Export CSV button, Prev/Next buttons
- `Input`, `Label` (shadcn/ui) — filter controls
- Existing `ghost-border`, `bg-card/50`, `bg-muted/30` CSS classes — use throughout for consistency

### Established Patterns
- Settings form fetches data in `useEffect` with `loading`/`error` state — same pattern for audit log fetch
- Chip/pill style: `text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full` for active filter highlight
- API calls via `frontend/src/lib/api.ts` — new `getAuditLogs()` and `exportAuditLogs()` functions follow same pattern

### Integration Points
- `SettingsPage.tsx` — new `<SectionCard>` added below the Code Execution section
- `frontend/src/lib/api.ts` — two new exported functions for audit endpoints
- `backend/app/api/` — new `audit.py` router; registered in `main.py`

</code_context>

<specifics>
## Discussion Specifics

- User confirmed prev/next paging over load-more: wants users to see total entry count ("Page N of M")
- Preset date buttons chosen over date picker inputs: faster to use, no library dependency
- Single-select action type dropdown over multi-select pills: simpler, dominant use case is one type at a time
- Formatted one-liner over raw JSON: human-readable details column per action type (mapping table in D-04)
- Full-dataset CSV export (not page-limited): separate export endpoint, blob URL download in frontend

</specifics>
