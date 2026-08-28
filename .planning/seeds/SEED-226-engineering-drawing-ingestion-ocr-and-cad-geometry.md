---
id: SEED-226
title: Engineering-drawing ingestion — the app already TELLS the user a PDF needs OCR, and then has no OCR to run
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, operator direction — "we need to support this business case and similar business cases"
surface: Agentic-RAG
severity: major
category: ingestion / extraction capability
priority: high
scope: >
  Close the drawing-shaped-document gap in ingestion, in three separable layers:
  (1) OCR for PDFs with no text layer (scan/photo);
  (2) full-page vision for drawings whose text layer exists but is spatially meaningless
      (AutoCAD "Plot to PDF" — machine-readable, yet every dimension is a floating text run);
  (3) native CAD geometry via DXF/DWG, for the cases where measurement — not retrieval — is
      the actual requirement.
  ⚠ This is ADDITIVE. Nothing about the shipped text/table/image path changes; those are
  strong and are the right engine for the ~95% of the library that is prose and tables.
affected_areas: [backend/extraction, backend/multimodal, ingestion-pipeline, sandbox-image, settings, frontend/documents]
relates_to:
  - SEED-006 (multimodal quality — ~5% of visible figures survive; this seed is the drawing half of it)
  - SEED-224 (document space redesign — its Ingestion tab is where an OCR/engine choice would surface)
  - SEED-142 (connected-drive auto-ingest — a drawing set arrives in bulk or not at all)
  - SEED-227 (the knobs this seed adds MUST be operator-controllable, not env vars)
  - backend/app/services/extractors/aspects/text.py
  - backend/app/services/extractors/aspects/images_pdf.py
  - backend/app/services/multimodal_service.py
  - backend/app/api/documents.py (empty_text_message — the sentence that names the gap)
  - docs/SANDBOX-PACKAGES.md (any new parsing library ships here in the same commit)
re_open_trigger: >
  ANY of: (a) a user uploads a PDF and receives the existing "needs OCR before it can be
  searched" sentence — that sentence IS the trigger and it already ships; (b) a business case
  asks the agent to quantify, measure, count or price anything drawn rather than written;
  (c) a `.dxf` or `.dwg` upload is attempted; (d) SEED-006 is picked up for any reason.
---

# Engineering-drawing ingestion

## The business case that planted this

Operator, 2026-08-28: a library of construction PDFs containing AutoCAD drawings. The agent
must read them, produce a **bill of quantities**, and price that BOQ against a **reference
Excel sheet held in the same library**. The operator's framing — *"and similar business
cases"* — is load-bearing: this is not one customer's request, it is the general shape of
*documents whose meaning is geometric rather than textual*.

The operator also corrected an assumption in the conversation that planted this seed, and the
correction is recorded because it changes the scope: **the incoming PDF is sometimes a picture
and sometimes machine-readable AutoCAD output.** Those are two different failure modes wearing
one file extension, and a design that handles only the scan is half a design.

## Measured at planting time (2026-08-28, HEAD on `develop`)

Every claim below was checked against the tree rather than recalled.

| Claim | Evidence |
|---|---|
| **No OCR exists anywhere in the backend.** | `grep -rinE "\bocr\b\|tesseract\|easyocr" backend/app --include=*.py` returns **exactly one hit, and it is a user-facing sentence**, not an implementation. `backend/requirements.txt` contains no OCR package. |
| **The app already tells the user OCR is what's missing.** | `backend/app/api/documents.py:156` — `application/pdf` → *"No text could be read from this PDF. It is most likely a scan or a set of images, which needs OCR before it can be searched."* ⚠ **The product names the capability it does not have.** That is an honest message and it is the right one; it is also a standing promise the ingestion path cannot keep. |
| **No CAD library is installed.** | `grep -rinE "ezdxf\|\.dxf\|\.dwg"` over `backend/app` → **no hits**; nothing in `requirements.txt`; nothing in `docs/SANDBOX-PACKAGES.md`. |
| **PDF text is `pypdf` / PyMuPDF, layout-lossy.** | `backend/app/services/extractors/aspects/text.py` — `legacy_text` joins `page.extract_text()` per page. A dimension string and the line it annotates arrive as unrelated tokens. |
| **PDF images ARE extracted and DO get a vision description.** | `images_pdf.py::pymupdf_full_images_pdf` (covers Form-XObjects, dedups by content hash) → `multimodal_service.describe_image` → *"1-2 sentence description"*, stored in `document_images`. |
| **That vision pass is capped, and the cap is invisible.** | `multimodal_max_vision_calls: int = 100` in `backend/app/models/user_settings.py:197` — DB-backed, **surfaced in no frontend file**. See SEED-227. |
| **Tables are already a first-class citizen.** | `multimodal_service.extract_and_store_tables` / `format_table_markdown_chunks` / `embed_and_store_table_chunks`. The reference **Excel price sheet is the easy half of the business case and it already works.** |
| **Docling was deliberately removed.** | `backend/requirements.txt:4,34-35` — *"after Docling rip"*, D-071.3-10. ⚠ **A future OCR proposal must not silently re-introduce it.** |

## Why the shipped path cannot answer the business case

Not a defect — a category mismatch, stated so no future phase re-litigates it:

1. **A drawing reaching the index as a caption.** A CAD sheet extracts as one image and is
   stored as *"a floor plan with dimensions"*. Every callout, tag, legend row and dimension is
   discarded. SEED-006 measured this at roughly **5% of visible figure content surviving**.
2. **The cap truncates a drawing SET.** 100 vision calls per document is generous for a report
   and arbitrary for a 40-sheet issue package.
3. **A machine-readable CAD PDF is not better off — it is differently wrong.** Text extracts
   fine and means nothing: `3600`, `A-12`, `TYP.` as free-floating runs with no spatial
   relation to the geometry they annotate. ⚠ **This case will look SUCCESSFUL to every gate we
   own** — text extracted, chunks embedded, no error, no empty-text sentence — and will produce
   confident wrong numbers. **It is the more dangerous of the two, precisely because nothing
   refuses.**
4. **Takeoff is measurement, not retrieval.** Quantity comes from polyline length, area,
   and count-per-layer. No embedding recovers a number that was never written down.

## The three layers, separable and independently shippable

**L1 — OCR for the no-text-layer PDF.** Detect (page text below a threshold), render at high
DPI, OCR, index the result, and **mark the document as OCR-derived so retrieval and the UI can
say so**. Candidates: Tesseract (local, free, weak on rotated drawing text), a cloud document-AI
endpoint (better, costs per page, egress), or a vision LLM used as the OCR engine (we already
have the client and the routing). Decide against real drawings, not benchmarks.
⚠ **The existing "needs OCR" sentence becomes the entry point**, not a dead end.

**L2 — full-page vision for drawings.** Bypass the thumbnail-caption path: render whole pages
and ask a vision model for a structured extraction (Pydantic — the project rule) of the title
block, revision, scale, legend and schedule tables. This is the layer that makes a **draft**
BOQ possible from PDF alone. ⚠ **Advisory, never contractual** — it must ship with its
uncertainty visible, and the operator's grounding/governance vocabulary already exists to carry
that.

**L3 — native CAD geometry (DXF, and DWG via conversion).** The only layer that turns takeoff
into arithmetic rather than inference. See the explanation below. This is where the business
case becomes *reliable* rather than *impressive*.

**Pricing (already possible today).** Given a BOQ table plus the reference workbook, the
sandbox has pandas + openpyxl and the agent can match line items and compute totals. **The
second half of the business case needs nothing new.** Any phase should ship L1/L2/L3 knowing
the downstream half is already standing.

## What DXF/DWG are, and why they are preferred *for this case only*

- **DWG** — AutoCAD's native binary format. Closed, versioned, no open parser of record.
- **DXF** — Autodesk's *documented interchange* format for the same model. Every AutoCAD (and
  every competitor) exports it. It is a real file format containing **entities**: `LINE`,
  `LWPOLYLINE`, `CIRCLE`, `HATCH`, `INSERT` (a block reference — one *instance* of a door, a
  fixture, a valve), each on a named **layer**, each with coordinates.
- **`ezdxf`** — a mature, permissively-licensed (MIT) pure-Python DXF library. It reads that
  entity graph directly: iterate the model space, filter by layer, sum `LWPOLYLINE` lengths,
  compute `HATCH` areas, **count `INSERT`s per block name**. That is a bill of quantities
  computed by arithmetic over the drawing's own data.
- **DWG → DXF** is a conversion step (ODA File Converter, or the CAD tool itself). It is the
  practical route when the customer only has DWG.

⚠ **"Prefer DXF over PDF" is scoped to quantity takeoff and nothing else.** A PDF is a *picture
of* a drawing; a DXF *is* the drawing. Where the requirement is measurement, one gives you
numbers and the other gives you a well-informed guess. **This says nothing about the rest of
the library** — for prose, reports, emails and spreadsheets the shipped pipeline is the right
engine and is not in question.

## Open questions for whoever picks this up

- Which OCR engine, decided on **real customer drawings**, not on a benchmark corpus.
- Does a `.dxf` upload become a first-class document type, or a sandbox-side tool the agent
  calls? (`ezdxf` in `Dockerfile.sandbox` is the cheap probe — one tag bump, `docs/SANDBOX-PACKAGES.md`
  updated in the same commit per the standing rule.)
- Where does per-page cost surface? OCR and full-page vision are **per page**, and a drawing set
  is many pages. The cap in SEED-227 is the control; the *estimate* is a separate UX question.
- How does a BOQ derived from L2 render its uncertainty, so no one prices a project off a guess?
