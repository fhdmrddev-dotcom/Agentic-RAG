# Phase 234: The Watch Loop — The Library Reads By Itself — Discussion Log

**Date:** 2026-09-06  
**Participants:** Operator, Gemini (Builder), Claude (Reviewer — baselines & measurement pack)  
**Status:** Completed & Locked  

---

## Gray Areas & Locked Decisions

### 1. Migration Numbering Allocation (BUS-143 Ruling)
- **Context:** Claude noted in `234-MEASUREMENTS.md` (R-1) and escalated in `BUS-143` that reserved migration numbers 157–160 were unusable as written because migrations 157–165 never existed in git history, while `166_app_settings_vision_model.sql` and `167_resize_skill_embeddings_with_chunks.sql` were already committed and applied to the live database on 2026-09-05.
- **Options Considered:**
  1. *(Recommended)* **Option A:** Renumber Phase 234 migrations to **168–171** (`168_connector_watches.sql`, `169_connector_watch_items.sql`, `170_documents_source_state.sql`, `171_reserved.sql`) and adjust downstream roadmap reservations accordingly.
  2. **Option B:** Keep 157–160 despite 166 and 167 already existing.
- **Decision:** **Option A (Ratified by Operator 2026-09-06)**.
- **Action:**
  - `BUS-143` answered and closed with operator ruling.
  - Phase 234 migrations will be:
    - `168_connector_watches.sql`
    - `169_connector_watch_items.sql`
    - `170_documents_source_state.sql`
    - `171_reserved.sql`
  - `.planning/ROADMAP.md` reservations updated.

---

### 2. Watch Management UI Placement (Pre-empting G-1)
- **Context:** `ConnectionFormPanel.tsx` (22/9/2418) and `ConnectionsTab.tsx` (24/8/1578) both fire G-5. The roadmap explicitly warns against bolting watch management onto settings components: *"G-1 RISK PRE-EMPTED — the sources UI gets its own home, never a bolt-on to ConnectionFormPanel.tsx or ConnectionsTab.tsx."*
- **Options Considered:**
  1. *(Recommended)* **Library Ingestion surface:** Add a dedicated "Watched Folders" section/modal inside `Library > Ingestion` alongside the folder picker and batch lanes.
  2. **Library dedicated sub-tab:** Add a "Watches" sub-view within Library alongside Documents/Ingestion/Indexing/Health.
  3. **Standalone Sources view:** A separate route or global modal outside Settings and Library.
- **Decision:** **Option 1 (Library Ingestion surface)**.
- **Rationale:** Keeps all content ingestion unified in the Library without creating a sprawling tab structure or violating G-1 on settings files.

---

### 3. Sync Cadence & Default Schedule (LIB-08, SURF-01)
- **Context:** `LIB-08` requires watching on the shipped scheduler (`scheduler_service.py` / `claim_due_schedules` in `db/schedules.py`). `SURF-01` strictly mandates the exact copy: *"checked every N minutes"* (never "instantly", never "on change").
- **Options Considered:**
  1. *(Recommended)* Standard cadence presets: 15m, 30m, 1h, 6h, 24h (defaulting to 30m), rendering "checked every N minutes".
  2. Fixed interval: Hardcoded 15-minute polling interval with no user choice.
  3. Customizable interval: Freeform minutes with a 5-minute floor.
- **Decision:** **Option 1 (Standard cadence presets: 15m, 30m, 1h, 6h, 24h; default 30m)**.
- **Rationale:** Provides clear, predictable operator choices while strictly adhering to `SURF-01` copy requirements and preventing erratic or sub-minute polling loops.

---

### 4. Anti-Injection Trifecta Defense (TRUST-03)
- **Context:** Synced external content enters the corpus unattended. If prompt injections are planted in synced documents, the agent could be manipulated into executing external writes (e.g. sending emails, posting messages) using granted connector tools.
- **Options Considered:**
  1. *(Recommended)* Mandatory approval gate: Disarm auto-execution of write tools when connection-sourced content is in retrieval context; require explicit human approval naming the source.
  2. Hard refusal: Strictly refuse write-capable tools on any turn that retrieved connected content.
- **Decision:** **Option 1 (Mandatory approval gate with explicit source naming)**.
- **Rationale:** Directly fulfills `TRUST-03`: *"Write-capable connector tools are fenced out of turns whose retrieval set contains connection-sourced content — built on the shipped approval checkpoint, inventing nothing."*

---

## Reviewer Measurements & Baseline Invariants Accepted
From `234-MEASUREMENTS.md`:
1. **Frontend Count Gate**: Baselined at `total 7538 · failed 1` (`WorkflowBuilderPage.canvas.test.tsx` STACK_TRACE_ERROR, SEED-171 flake). Gate verification will enforce zero regressions on in-scope suites and per-file deltas rather than total green.
2. **Backend Unit Ceiling**: 71 failed / 3719 passed / 0 collection errors. 71 is the exact ceiling (zero headroom). Zero new backend failures allowed.
3. **Stale `documents.py` Lines**: `accept_classification` is at `:1847`; rule evaluation inside `ingest_document` is at `:2280`. H-4 fence sits on `accept_classification`.
4. **`schedules.py` Ownership**: `claim_due_schedules` is in `backend/app/db/schedules.py:263` (1/1/359). Phase 234 owes G-5 ledger rows for **both** `scheduler_service.py` (5/2/399) and `schedules.py`.
5. **Retire CLAUDE.md Rule in Same Commit**: Line 34 manual-upload-only rule retired in the same commit as the first sync (`SEED-142`).
