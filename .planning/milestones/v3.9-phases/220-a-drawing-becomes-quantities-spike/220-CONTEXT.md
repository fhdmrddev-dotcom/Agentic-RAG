# Phase 220: A Drawing Becomes Quantities — SPIKE - Context

**Gathered:** 2026-08-30  
**Status:** Ready for planning  
**Goal:** Prove — or kill — the drawing-to-bill-of-quantities business case on ONE real drawing (`.dxf`) and ONE real rate sheet (`.xlsx`), end to end, without building a full CAD product first.

---

<domain>
## Phase Boundary

- **In Scope (SPIKE):**
  - Accept `.dxf` uploads in the Library (`application/dxf` or `.dxf` filename).
  - Extract counted items (`INSERT` blocks), measured dimensions (`DIMENSION`), and specification callouts (`MULTILEADER` / `MTEXT`) via `ezdxf` (MIT).
  - Resolve `$INSUNITS` per drawing; refuse unitless drawings (`$INSUNITS=0`) honestly without guessing units.
  - Read reference rate sheets through the shipped `extract_excel_tables` (never a private parser).
  - Match drawing items against rate sheet rows via an LLM matching prompt with the rate sheet in context, producing a priced Bill of Quantities (BOQ).
  - Clearly classify every output line with its explicit basis:
    - `read`: Exact count from a CAD block.
    - `matched`: Confident semantic match against a single rate line.
    - `ambiguous`: Candidate matches exist; escalated to operator review without silent pricing.
    - `unpriced` / `inferred`: Advisory or unpriced item.
  - Surface the Takeoff & Quantities breakdown in the Library (`DocumentDetailPanel` for `.dxf` documents).
  - Promote `ezdxf` to `backend/requirements.txt` and `docs/SANDBOX-PACKAGES.md`.

- **Out of Scope (Deferred in `SEED-226` / Future Phases):**
  - OCR for scanned PDFs with no vector text layer (L1 in `SEED-226`).
  - Full-page multimodal vision extraction for rasterized CAD PDFs (L2 in `SEED-226`).
  - Proprietary `.dwg` parsing (requires external converters like ODA).
  - Automated polygon area / volume derivation from 2D plan lines alone without height/boundary markup.
  - Multi-file drawing set batch reconciliation.

</domain>

---

<decisions>
## Implementation Decisions

### 1. Extraction Engine & Units (`TAKEOFF-01`)
- **D-01:** Use `ezdxf` in `backend/app/services/extractors/aspects/dxf.py` to extract modelspace entities: `INSERT` (block counts), `DIMENSION` (measurement values computed by CAD software), `MULTILEADER` & `MTEXT` (specifications).
- **D-02:** Honor `$INSUNITS` strictly (1: inches, 2: feet, 4: mm, 5: cm, 6: m). If `$INSUNITS === 0` (unitless), return an explicit refusal status (`"refused: unitless drawing"`) rather than assuming millimeters.
- **D-03:** Store the structured takeoff payload in `documents.metadata` under `_takeoff` so no schema migration is required for the spike.

### 2. Rate Matching & Grounding (`TAKEOFF-02`, `TAKEOFF-03`)
- **D-04:** Rate sheets are loaded using the app's existing `extract_excel_tables(content)` in `multimodal_service.py` to ensure parser consistency.
- **D-05:** Matching is performed using a grounded LLM prompt that receives the drawing items and the extracted rate sheet table.
- **D-06:** **Anti-Ambiguity Invariant:** If a CAD item matches more than one rate line (e.g. *1/2" Gypsum Board* matching *Ceiling Board @ $31.00* vs *Wall Board @ $18.75*), the line is marked `status: "ambiguous"` with candidate codes listed. It is NEVER priced by arbitrary position in the sheet.

### 3. UI Presentation in Library (`TAKEOFF-04`)
- **D-07:** When a `.dxf` document is selected in the Library, `DocumentDetailPanel` mounts a **"Takeoff & Quantities"** tab/section.
- **D-08:** Displays a summary card (Total Estimated Cost, Counted items total, Ambiguity count) and an interactive table with basis badges (`READ`, `MATCHED`, `AMBIGUOUS`, `UNPRICED`).
- **D-09:** Ambiguous lines render an inline dropdown/picker allowing the operator to select the intended rate line.
- **D-10:** Provide an **"Export Takeoff (CSV)"** action button to download the itemized bill of quantities.

### 4. Dependencies & Packaging
- **D-11:** Add `ezdxf>=1.3.0` to `backend/requirements.txt` and document its MIT license and purpose in `docs/SANDBOX-PACKAGES.md`.

</decisions>

---

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` § Phase 220 lines 595–616 (Phase specification & success criteria)
- `.planning/seeds/SEED-226-engineering-drawing-ingestion-ocr-and-cad-geometry.md` (Domain context & background)
- `backend/scripts/probe_dxf_takeoff.py` (Proven extraction & matching prototype)
- `backend/app/services/multimodal_service.py` (`extract_excel_tables`)
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` (Target UI mount surface)
- `docs/SANDBOX-PACKAGES.md` (Package registration contract)

</canonical_refs>

---

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/scripts/probe_dxf_takeoff.py`: Contains proven block counting, text cleaning regex (`_FMT`), unit resolution table, and dimension query logic.
- `backend/app/services/multimodal_service.py:extract_excel_tables`: Shipped Excel table parser that extracts headers and rows from `.xlsx` spreadsheets.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx`: Existing right-side drawer with tab sections (Metadata, Versions, Images, Tables).

### G-5 Hot Files & Touchpoints
- `backend/app/services/extractors/` (New `dxf.py` extractor)
- `backend/app/api/documents.py` (DXF upload handling & takeoff query endpoints)
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` (Takeoff section rendering)
- `docs/SANDBOX-PACKAGES.md` & `backend/requirements.txt` (ezdxf dependency)

</code_context>
