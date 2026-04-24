# Phase 31: Audit Log — Settings UI — Discussion Log

**Date:** 2026-04-14
**Status:** Complete

---

## Gray Areas Selected

User selected all four presented areas: Pagination style, Filter UX, Metadata column, CSV export scope.

---

## Q&A Transcript

### Area: Pagination Style

**Q:** How should the audit log table handle multiple pages of entries?

Options presented:
1. Prev / Next buttons — "Page N of M" indicator, server returns fixed page + total count
2. Load more button — appends rows, no total count needed

**A:** Prev / Next buttons (option 1)

---

### Area: Filter UX

**Q:** How should users filter by date range?

Options presented:
1. Preset buttons — "All | 7d | 30d | 90d" pills, no date picker library
2. Custom date range inputs — two `<input type="date">` fields

**A:** Preset buttons (option 1)

**Q:** How should users filter by action type?

Options presented:
1. Single-select dropdown — "All types" + 8 action type options
2. Multi-select pill toggles — 8 toggleable pills

**A:** Single-select dropdown (option 1)

---

### Area: Metadata Column

**Q:** What should the Details column show from the metadata JSON?

Options presented:
1. Formatted one-liner — per-action-type human-readable string
2. Raw JSON (truncated) — raw metadata string, truncated with tooltip
3. Nothing — no details column

**A:** Formatted one-liner (option 1)

---

### Area: CSV Export Scope

**Q:** What should the Export CSV button download?

Options presented:
1. Full filtered dataset — separate export endpoint, all matching rows regardless of pagination
2. Current page only — client-side CSV from current table rows

**A:** Full filtered dataset (option 1)

---

## Deferred Ideas

None raised during discussion.
