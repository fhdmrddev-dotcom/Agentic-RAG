# Phase 212 Plan 06 Summary: Gap Closure Round 1 — Catalog Reachability & Popular Cards

**Plan:** `212-06-PLAN.md`
**Wave:** 5 (Gap Closure Round 1)
**Status:** Complete
**Date:** 2026-08-27

---

## Accomplishments

1. **Services Catalog Merging in `ConnectionsTab` (`CAT-01`, `CAT-02`, `SC#1`):**
   - Merged `CATALOG_SERVICES` into `ConnectionsTab.tsx`, allowing users to browse all curated and unconfigured services in a unified 5-column table (`CONNECTIONS_COLUMNS`).
   - Unconfigured catalog rows render with Mark, Name, Tagline, `🔒 <defaultHost>`, `—` Used by, `Not set` Credential, `Not connected` State (hollow dot), and a `Connect` button.
   - Configured DB connection rows render with live state and actions without creating duplicate catalog entries.

2. **Popular Card Row & One-Click Connect (`SC#3`, Reference Screenshot `2026-08-24 202011.png`):**
   - Restored the Popular card section above the filter bar per the reference UI in `Screenshot 2026-08-24 202011.png`.
   - Each card displays the service glyph, name, and a `Connect` button.
   - Popular services (e.g. Slack, GitHub, Notion, Jira, SMTP) appear in the shortcut cards above AND in the unified table list below.
   - Clicking `Connect` on a Popular card or on a table row immediately opens `ConnectionFormPanel` with `presetServiceId` pre-filled for one-click connection creation.

3. **State-Based Filtering & Query Matching (`CAT-03`):**
   - Maintained strictly state-based filter chips (`All` | `Connected` | `Not connected`) with zero verb/capability chips.
   - `Not connected` filter chip shows all unconfigured catalog services plus any configured connections that are unready or disabled.
   - Search input matches across both configured connections and catalog entries (name, service_id, tagline, description, host).
   - Provenance tag (`ADDED BY URL`) remains isolated to Column 1 (beside the name) and never enters the State column.
   - No false tools badge is rendered on unconfigured/not connected services.

4. **Multi-Gate Battery Verification:**
   - **Frontend Unit Tests:** 86/86 passing in `ConnectionsTab.test.tsx`, 144/144 passing in `ConnectionFormPanel.test.tsx`, 42/42 passing in `connectionMark.test.tsx`, 21/21 in `connectionVerbFence.test.ts`, 3/3 in `servicesCatalog.test.ts`.
   - **Frontend Typecheck (`npx tsc --noEmit -p tsconfig.app.json`):** Exactly 34 pre-existing baseline errors (0 errors in Phase 212 files).
   - **Backend Seam Test (`pytest tests/unit/test_212_discover_seam.py`):** 2/2 passing (100%).
   - **Zero `[title]` Nodes:** Maintained across all newly added and modified components (WCAG/accessible text standard).
