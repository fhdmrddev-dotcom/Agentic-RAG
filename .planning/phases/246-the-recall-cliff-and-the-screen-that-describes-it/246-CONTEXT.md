# Phase 246: The Recall Cliff, and the Screen That Describes It - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 246 delivers honest out-of-the-box recall for tenants owning a small share of a large corpus (`RECALL-01`) and ensures the search breadth displayed on the Settings screen is the breadth actually in force on the Postgres server (`RECALL-02`).

Specifically:
1. Out-of-the-box `hnsw.ef_search` is raised from 40 to 200 without requiring an operator setting change or database migration, restoring recall from 0.040 to 1.000 for a 0.2% tenant in a 100,000-chunk corpus (`QUEUE-06`).
2. The no-op shortcut in `retrieval_tuning.py` probes the server's actual setting (`current_setting('hnsw.ef_search', true)`) rather than comparing against a hardcoded compiled-in `40`, eliminating `SEED-268`.
3. The Settings screen displays the true default (200) and in-force value, supported by the Search tab save mechanism proven in Phase 242.
4. `retrieval_service.py` is strictly fenced with 0 lines modified, avoiding its 3rd G-5 landing during this phase.

</domain>

<decisions>
## Implementation Decisions

### 1. `retrieval_service.py` G-5 Extraction Obligation
- **D-246-01: Strictly fence `backend/app/services/retrieval_service.py` (0 lines touched in Phase 246).**
  - Per ROADMAP mandate, the extraction proposal was evaluated as Option 1 at `discuss-phase 246`.
  - Architecture evaluated: Option 1A (extract document resolution/enrichment to `document_retrieval.py` and fusion/dedup to `retrieval_fusion.py`) vs Option 1B (strict fence).
  - Rationale: `retrieval_service.py:126` already dynamically resolves `(user_settings.hnsw_ef_search if user_settings else settings.hnsw_ef_search)` and delegates knob application to `retrieval_tuning.py`. It hardcodes no defaults. All Phase 246 goals can be completely achieved via `config.py`, `models/user_settings.py`, `services/retrieval_tuning.py`, and `SettingsPage.tsx`. Fencing `retrieval_service.py` keeps it byte-untouched, preventing a 3rd G-5 landing and avoiding unnecessary blast radius. The G-5 extraction obligation remains tracked as OWED for whichever future phase needs to modify retrieval pipeline internals.

### 2. Default Search Breadth & `D-v4.0-EF-DEFAULT` Reversal (`RECALL-01`)
- **D-246-02: Formally re-open and reverse `D-v4.0-EF-DEFAULT`.**
  - `D-v4.0-EF-DEFAULT` kept the default at 40 because changing a retrieval default across every install on one phase's evidence was a bigger claim than the evidence supported.
  - Phase 246 explicitly reverses this decision based on reproducible 100k-chunk benchmark data showing `recall@20` jumping from 0.040 (at 40) to 1.000 (at 200).
- **D-246-03: Code default (No database migration).**
  - Update `Settings.hnsw_ef_search: int = 200` in `backend/app/config.py`.
  - Update `UserEffectiveSettings.hnsw_ef_search: int = 200` and the fallback default in `_val(row, "hnsw_ef_search", "hnsw_ef_search", 200)` in `backend/app/models/user_settings.py`.
  - Existing `app_settings` rows where `hnsw_ef_search IS NULL` automatically evaluate to `200`. Zero migrations required.
- **D-246-04: Dual-measurement in recall harness.**
  - The recall verification harness must assert an HNSW index scan (`idx_scan > 0` via execution plan inspection, not Seq Scan).
  - Verify `recall@20` before (0.040) and after (1.000) on the 100k-chunk benchmark.
  - Record p95 query latency deltas before and after alongside recall for visibility, avoiding a brittle hard timeout wall.

### 3. Server GUC Shortcut Fix (`RECALL-02` / `SEED-268`)
- **D-246-05: Server setting probe with transaction isolation, null-safe fallback, and TTL caching.**
  - Replace the compiled-in `_SERVER_DEFAULT_EF_SEARCH = 40` shortcut in `backend/app/services/retrieval_tuning.py` (Finding 2).
  - **Fresh Connection / Isolation (2a):** `SELECT current_setting('hnsw.ef_search', true)` is executed on a clean connection outside of any active transaction. Tested with a driven unit test proving a prior `SET LOCAL` on a borrower cannot poison the cached server default.
  - **NULL / Missing GUC Fallback (2b):** If the query returns `NULL` (e.g. pgvector not loaded or GUC unknown), the server default resolves to `None`. In this state, `apply_hnsw_session_knobs` issues nothing and lets the server execute untuned.
  - **TTL-bounded Caching (2c):** Cache the probed setting with a 60-second TTL rather than process-lifetime permanence, ensuring that an operator's `ALTER SYSTEM` or `ALTER DATABASE` takes effect without requiring a server reboot, permanently closing the staleness loophole.
  - **Replacement Scope (Finding 4):** The probed server default specifically replaces the `:155` no-op shortcut. Lines `:131` (unparseable input) and `:154` (out-of-range input) retain their strict fail-safe behavior: issue NOTHING and run untuned at the server's own setting.
  - **Hot-Path Statement Acknowledged (Finding 3):** Raising default to 200 inverts the shortcut guard (`200 != 40`), meaning `SET LOCAL` will execute on every vector search. This minor in-transaction overhead (<1ms) is explicitly accepted as the mechanism that delivers the 0.040 $\rightarrow$ 1.000 recall restoration.

### 4. Settings UI & Retrieval Card Copy
- **D-246-06: Pre-fetch loading state without compiled-in guesses (Finding 1).**
  - In `frontend/src/pages/SettingsPage.tsx`, initialize `hnswEfSearch` as `useState<number | null>(null)`.
  - While pre-fetch (`hnswEfSearch === null`), render a neutral loading placeholder/skeleton rather than guessing 40 or 200 on first paint.
  - Delete the dead `?? 40` fallback entirely in `setHnswEfSearch(data.hnsw_ef_search)` since the backend GET `/settings` schema returns a non-optional integer.
  - This eliminates compiled-in frontend defaults and guarantees the screen only asserts breadth values received from the server.
- **D-246-07: Update help text to state 'Default is 200'.**
  - Update the copy in `frontend/src/pages/SettingsPage.tsx` from `"200 is a good starting point"` to `"Default is 200 — on our 100,000-passage test library it returned every result that should have been found, for small and large teams alike. Higher is not better: 1000 measured worse than 400."`

### 5. Governance & Verification Directives
- **D-246-08: Waive G-2 sketch in writing (Finding 5).**
  - G-2 is waived because the UI change is limited to a 5-word lead-phrase update on an existing card and rendering null during initial load; no new layout or component surface is created.
- **D-246-09: SC#2 verification scoped to local database under test (Finding 6).**
  - SC#2 asserts locally that modifying Search breadth in the Settings tab persists to `app_settings` and returns 200. Production promotion remains deferred per `D-242-08`.
- **D-246-10: Hot File Ledger sync for `retrieval_tuning.py`.**
  - Update the row and section in `docs/HOT-FILE-LEDGER.md` to reflect Phase 246's second phase landing (re-derived at HEAD: 1 phase / 3 commits / 274 lines; advancing to 2 phases).

### Claude's Discretion
None — all key implementation choices (fencing strategy, migration avoidance, server probe caching, and copy calibration) were confirmed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Retrieval & Tuning Implementation
- `backend/app/services/retrieval_service.py` — Fenced file (must remain byte-untouched). Note lines 126-130 for dynamic parameter forwarding.
- `backend/app/services/retrieval_tuning.py` — Home of `apply_hnsw_session_knobs`, `_SERVER_DEFAULT_EF_SEARCH`, and GUC session logic.
- `backend/app/config.py` — Home of `Settings.hnsw_ef_search: int`.
- `backend/app/models/user_settings.py` — Home of `UserEffectiveSettings` and `_val` fallback logic.

### Settings UI & API
- `frontend/src/pages/SettingsPage.tsx` — Retrieval card Search breadth control (`hnswEfSearch`), fallback values, and help text.
- `backend/app/api/user_settings.py` — Settings endpoint returning effective user settings.

### Governance, Seeds, and Prior Decisions
- `.planning/ROADMAP.md` § Phase 246 — Goal, success criteria, and landmines.
- `.planning/REQUIREMENTS.md` § RECALL-01, RECALL-02 — Traceability and dependency on SHIP-01.
- `.planning/PROJECT.md` § D-v4.0-EF-DEFAULT — Original decision to keep default at 40 at v4.0 close.
- `.planning/seeds/SEED-268-the-settings-screen-can-show-a-search-breadth-that-is-not-in-effect.md` — Root cause and analysis for RECALL-02.
- `docs/HOT-FILE-LEDGER.md` § `retrieval_service.py` and `retrieval_tuning.py` — Ledger entries and G-5 status.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apply_hnsw_session_knobs` in `retrieval_tuning.py`: already provides safe, injection-proof, transactional `SET LOCAL` with error-swallowing for unsupported server parameters.
- `_val` helper in `models/user_settings.py`: handles fallback from row column -> env/config default.
- `NumberInput` and `FieldRow` in `SettingsPage.tsx`: renders the bounded search breadth input.

### Established Patterns
- Transaction-scoped GUCs: `dependencies.py` opens `conn.transaction()`, ensuring any `SET LOCAL` reverts on commit/rollback with zero cross-request leakage.
- Code defaults over migrations: When introducing new defaults without table alterations, changing the Pydantic model default and `_val` fallback ensures zero schema churn.

### Integration Points
- `config.py` default `200` $\rightarrow$ `models/user_settings.py` `_val` $\rightarrow$ `retrieval_service.py:126` $\rightarrow$ `retrieval_tuning.py` $\rightarrow$ Postgres `SET LOCAL`.

</code_context>

<specifics>
## Specific Ideas
- The harness must verify against a real index execution plan (`idx_scan > 0`), guarding against the Seq Scan trap identified in `241-VERDICT-CORRECTION-PLAN-PATH.md`.

</specifics>

<deferred>
## Deferred Ideas
None — discussion stayed strictly within phase scope.

</deferred>

---

*Phase: 246-The Recall Cliff, and the Screen That Describes It*
*Context gathered: 2026-09-13*
