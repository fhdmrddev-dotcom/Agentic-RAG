# Phase 247: Sources & Watches — the surface you now live on - Context

**Gathered:** 2026-09-14  
**Status:** Ready for planning  
**Ratified Sketch:** [.planning/sketches/247-sources-and-watches/index.html](file:///c:/Vibe%20Apps/Agentic%20RAG/.planning/sketches/247-sources-and-watches/index.html) (Variant A approved by Operator)  

---

<domain>
## Phase Boundary

Phase 247 makes a watched source tell the truth about itself — what it brought in, where that came from, whether it is healthy, and when something went missing — so an operator can rely on background watch loops instead of checking them by hand.

Specifically:
1. Documents ingested from Google Drive (`WATCH-01`) and OneDrive/SharePoint (`WATCH-02`) carry the true remote folder hierarchy in `metadata.source.path` (e.g. `/Finance/2026/Q3_Budget.xlsx`), ensuring path-based classification rules match as expected.
2. A watch card reports the health of the connection it rides (`WATCH-03` / `BUG-260909-03`): a healthy connection whose last run failed (e.g. transient 429 rate limit or timeout) reads healthy (`● Connected` + `⚠ Run failed (429)`), while a disabled connection reads stopped immediately (`⊙ Connection Off`).
3. Pressing "Sync now" delivers an answer where pressed (`WATCH-04` / `BUG-260909-04`): the section stays open with a row-level in-flight state (`Syncing...`), and the outcome lands inline (`✓ Synced just now (0 changes)`) without unmounting or discarding view.
4. Remote-deleted files state when they vanished via `missing_since` (`WATCH-05` / `BUG-260909-05`), retained in Library until purged.
5. Action labels match what controls do (`WATCH-06` / `BUG-260909-06`): navigation is labelled as navigation (`Open Connection Settings ↗`), never an imperative write.
6. Timestamps follow a unified time vocabulary (`WATCH-07` / `BUG-260909-07`): preposition collisions are eliminated (*"Last read successfully on 8 min ago"* $\rightarrow$ *"Last read successfully 8m ago"*).
7. Phase 240's seven open build-review warnings (`WATCH-08` / `BUG-260910-02`) are formally dispositioned: WR-04, WR-07, and WR-09 fixed in code; WR-02, WR-05, WR-06, WR-08 accepted and documented as debt.
8. `backend/app/api/connectors.py` is strictly fenced (0 lines touched), avoiding its owed G-5 extraction at 2,140 lines.

</domain>

---

<decisions>
## Implementation Decisions

### 1. Remote Path Hierarchy & Ingest Propagation (`WATCH-01`, `WATCH-02`, `SEED-282`)
- **D-247-01: Full relative path hierarchy from watched folder root.**
  - For Google Drive (`google_drive.py`): Ingest builds and passes `path` on `SourceFile`. During listing, folder hierarchy relative to the watched root folder is resolved and formatted as `/Folder/Subfolder/filename.ext`.
  - For Microsoft Graph (`microsoft_graph.py`): `parentReference.path` is parsed cleanly, stripping the `/drive/root:` prefix to produce the clean relative hierarchy without truncation or prefix corruption.
  - Ingestion enrichment (`ingest_enrich.py` / `watch_service.py`): Populates `metadata.source.path` directly from `f.path`. Classification rules matching on `path` (e.g. `path contains '/Finance/'`) now evaluate against the full hierarchy.
  - **Write-forward only (no database migration):** Existing document rows are updated opportunistically on subsequent watch syncs; no blocking schema or data migration is run.

### 2. Watch Card Dual Health Architecture (`WATCH-03`, `BUG-260909-03`)
- **D-247-02: Lock Variant A (Two-Tier Status Pill).**
  - Card header clearly separates **Connection Health** from **Run Outcome**:
    - **Connection Status Pill (Left):** Reflects live connection state directly: `● Connected` (green subtle) or `⊙ Connection Off` (neutral/amber). When an operator switches off a connection in Settings, watches on that connection transition immediately to `⊙ Connection Off` without waiting for a scheduled tick.
    - **Run Outcome (Right/Secondary):** When connection is connected but the last run encountered an issue (e.g. 429 rate limit or timeout), the connection pill remains `● Connected` and a secondary indicator explains: `⚠ Run failed (429)`.
    - **Diagnostic Note:** In the card details, an honest non-alarming banner explains: *"Transient run refusal (Connection is healthy): Google Drive/Gmail API returned 429 Rate Limit Exceeded. Reading will retry on the next tick in 11m."*
  - Re-enabling a connection in Settings immediately clears the stopped banner and resumes normal scheduled ticks.

### 3. Non-Collapsing "Sync Now" & Inline Feedback (`WATCH-04`, `BUG-260909-04`)
- **D-247-03: Row-level loading state without section unmounting.**
  - Remove `setLoading(true)` on background refetches and post-sync calls in `WatchedFoldersSection.tsx`. Initial page load retains initial loading, but subsequent updates are row-level or background queries.
  - Clicking "Sync now" flips the clicked button to a spinner (`<span class="spinner"></span> Syncing...`).
  - When the sync tick completes, an inline result badge renders adjacent to the button: `✓ Synced just now (0 changes)` (or `✓ Synced: 1 updated`), persisting smoothly. The section remains open and stable throughout.

### 4. Missing Files & Time Vocabulary (`WATCH-05`, `WATCH-07`, `BUG-260909-05`, `BUG-260909-07`)
- **D-247-04: Populate `missing_since` on item state transition.**
  - `watch_service.py`: In the deletion arm where `connector_watch_items.state` transitions to `'missing'`, pass `missing_since = datetime.now(timezone.utc)`.
  - In the re-appearance / restore arm, clear `missing_since = None` when state returns to `'present'`.
  - Display in UI: The tracked files table renders `Missing since 5 Sep 2026 (9d ago) · Retained in Library`.
  - Retain existing policy: Remote deletions never delete Library documents; files stay indexed with `[Missing at source]` badge until explicitly pruned via "Purge missing files".
- **D-247-05: Unified time formatting without preposition collisions.**
  - Update `sourceHealthVocabulary.ts:400` (`lastGood` helper) and related vocabulary leaves:
    - Relative time: `Last read successfully 8m ago` (dropped the `"on"`).
    - Absolute time: `Last read successfully 2 Sep, 09:14`.
    - No string ever concatenates `"on"` with relative phrases.

### 5. Action Label Honesty (`WATCH-06`, `BUG-260909-06`)
- **D-247-06: Navigation controls must read as navigation.**
  - In `sourceHealthVocabulary.ts:185`, update `CONTROL_FOR_CAUSE.connection_disabled.label`:
    - From `"Turn ${named(connectionName)} back on"` to `"Open ${named(connectionName)} in Settings ↗"`.
  - When connection is unnamed, fallback reads `"Open Connection Settings ↗"`.
  - Control icon/text explicitly communicates traveling to Settings $\rightarrow$ Connections, satisfying the **consequence $\neq$ receipt** design rule.

### 6. Phase 240 Build-Review Warnings Disposition (`WATCH-08`, `BUG-260910-02`)
- **D-247-07: Fix in-scope warnings in code; document remainder as accepted debt.**
  - **Fixed in code:**
    - **WR-04:** `google_drive.py:239` — Resolve user label name via Gmail labels API rather than passing `label_name=label_id` (`/Label_9`), so document breadcrumbs and classification rules match human label names.
    - **WR-07:** `test_boundary_fence.py` — Update non-recursive glob to `rglob` / recursive traversal so future modules under `services/sources/mail/` cannot escape the boundary fence.
    - **WR-09:** `watchProductMark.ts` — Add Microsoft Graph detection and mark (`service_id === 'microsoft_graph' || service_id === 'onedrive'` $\rightarrow$ `'microsoft-onedrive'`).
  - **Formally dispositioned as accepted debt (written rationale):**
    - **WR-02 (5,000 message ceiling):** Bound is mitigated because mail listing suppresses deletion detection wholesale (`WR-03`). Documented as accepted debt; tracked in `SEED-264`.
    - **WR-05 (conversation test assertions):** Test suite string greps are accepted as debt; endpoint is functional in production.
    - **WR-06 (`ingest_splice.py` metadata blob snapshot):** MIME branch collision is benign today; accepted as debt.
    - **WR-08 (`gmail.py` URL interpolation):** Validated that uvicorn decodes `%2F` safely before reaching handler; accepted as low risk debt.

### 7. G-5 Governance & Hot File Fencing
- **D-247-08: Strictly fence `backend/app/api/connectors.py` (0 lines touched).**
  - `api/connectors.py` is at 44 commits / 27 phases / 2,140 lines with an extraction owed. Phase 247 strictly fences this file. Zero lines modified.
- **D-247-09: Extraction Proposal for `WatchedFoldersSection.tsx` (G-5 Option 1).**
  - Evaluated: Option 1A (extract `WatchRow` and item table to `WatchRowCard.tsx`, reducing 1094 lines to ~350) vs Option 1B (modular extraction of sub-components).
  - Approach: Extract `WatchRowCard.tsx` to isolate row rendering, status badge composition, and inline sync feedback, bringing `WatchedFoldersSection.tsx` well below the 1,000-line ceiling and satisfying G-5.
- **D-247-10: Hot File Ledger sync.**
  - Update ledger entries in `docs/HOT-FILE-LEDGER.md` for `WatchedFoldersSection.tsx`, `sourceHealthVocabulary.ts` (crosses to 3 phases), `watch_service.py`, `google_drive.py`, and `microsoft_graph.py` in the same commit.

</decisions>

---

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Adapters & Watch Loop
- `backend/app/services/sources/adapters/google_drive.py` — Google Drive adapter (path resolution & WR-04 label name fix).
- `backend/app/services/sources/adapters/microsoft_graph.py` — OneDrive/SharePoint adapter (path resolution & prefix stripping).
- `backend/app/services/watch_service.py` — Watch sync loop (`missing_since` write, deletion arm).
- `backend/app/services/sources/base.py` — `SourceFile` dataclass (`path` field).
- `backend/app/models/connector.py` — Connector database models.

### Frontend Watched Folders Surface
- `frontend/src/components/sources/WatchedFoldersSection.tsx` — Watched folders container, loading states, and row list.
- `frontend/src/components/sources/sourceHealthVocabulary.ts` — Cause sentences, labels, and `lastGood` time formatting.
- `frontend/src/components/sources/watchProductMark.ts` — Product marks mapping (WR-09 Graph fix).
- `.planning/sketches/247-sources-and-watches/index.html` — Ratified Variant A HTML mockup.

### Governance, Bugs & Seeds
- `.planning/phases/247-sources-and-watches/247-SKETCH-BRIEF.md` — Scope transfer brief and measured traps.
- `.planning/reported-bugs/` — `BUG-260909-03`, `BUG-260909-04`, `BUG-260909-05`, `BUG-260909-06`, `BUG-260909-07`, `BUG-260910-02`, `BUG-260913-01`.
- `.planning/seeds/SEED-282-source-file-path-is-synthetic-no-adapter-populates-it.md` — Path evaluation root cause.
- `docs/HOT-FILE-LEDGER.md` — Hot file scan records.

</canonical_refs>
