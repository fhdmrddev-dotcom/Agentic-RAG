# Phase 46: Document Version Deletion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 46-document-version-deletion
**Areas discussed:** Delete dialog design, Single-version simplification, History panel delete access

---

## Delete dialog design

| Option | Description | Selected |
|--------|-------------|----------|
| Two-action footer | Footer has three buttons: Cancel \| Delete This Version \| Delete All Versions. Fewest clicks, matches existing button-per-action style. | ✓ |
| Radio + single confirm | Dialog body has two radio options; one 'Delete' button confirms the selected scope. More explicit — user must actively pick scope before confirming. | |

**User's choice:** Two-action footer
**Notes:** Label the "Delete This Version" button with the actual version number (e.g. "Delete v3") for clarity.

---

## Single-version simplification

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-simplify | Show plain "Delete document?" for v1 docs — no version choice needed. Full two-button dialog only appears when version_number > 1. | ✓ |
| Always show both options | Show both options for every document even when equivalent. Consistent but redundant for most users. | |

**User's choice:** Auto-simplify
**Notes:** The `hasVersions(doc)` helper already exists in DocumentList.tsx — gates the conditional rendering.

---

## History panel delete access

| Option | Description | Selected |
|--------|-------------|----------|
| No — main row only | Delete only from main document row. Historical versions are view-only (restore only). Keeps Phase 46 scope tight. | ✓ |
| Yes — add delete per history row | Add delete button alongside Restore in version history table. More power but doubles backend logic. | |

**User's choice:** No — main row only
**Notes:** VersionHistoryPanel stays unchanged. Individual historical-version delete deferred.

---

## Claude's Discretion

- Error state: show inline error inside dialog (don't close on failure)
- Loading state on active delete button while request in flight
- Exact wording of "Delete All" description copy

## Deferred Ideas

- Delete individual historical versions from the Version History panel — future phase
