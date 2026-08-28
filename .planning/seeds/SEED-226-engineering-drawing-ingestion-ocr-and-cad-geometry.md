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

## ⚠ MEASURED 2026-08-28 with `backend/scripts/probe_drawing_pdf.py`

The probe calls the app's OWN extraction path (`extract_composable`, the one
`api/documents.py:303` uses) rather than modelling it. **Run against two stand-in
drawings**, one vector plot and one scan — *stand-ins, not the operator's real file*,
built only so the probe could be proven before a real drawing is spent on it:

| | vector CAD plot | scan |
|---|---|---|
| text (shipped `legacy` engine) | **229 chars** | **0** |
| text (`pymupdf` engine) | 229 chars — **identical** | 0 |
| images via the REAL path | 0 | **1** |
| images via the legacy fallback | 0 | **0** — *disagrees* |
| tables | camelot 0 · pdfplumber **1** | 0 |
| vector drawing ops | 10 | 0 |

**The vector plot's entire extracted text, verbatim:**

> `GROUND FLOOR PLAN SCALE 1:100 DRG No. A-1001 REV C A-101 OFFICE 5200 4100 A-102 OFFICE
> 5200 3600 A-103 STORE 2400 3600 A-104 CORRIDOR 12800 1800 LEGEND --- BLOCKWORK 140mm ===
> BLOCKWORK 215mm TYP. DOOR 900 x 2100 ALL DIMS IN mm`

**That is the whole finding in one line.** Every number a BOQ needs is present, and not one
of them is attached to what it measures. `5200 4100` follows `A-102 OFFICE` by adjacency in
a text stream, not by any structural relation — nothing says those are that room's
dimensions rather than the next room's, and nothing marks `900 x 2100` as a door type
rather than a quantity. **The extraction did not fail. It succeeded, and produced something
from which a confident wrong answer is easy to compute.**

**Four findings the probe added to this seed:**

1. **Both text engines return byte-identical output on the vector plot.** So
   `extraction_text_engine_pdf: legacy → pymupdf` — proposed in SEED-227's first draft as a
   cheap improvement for CAD PDFs — **buys nothing here.** ⚠ **A plan that assumed it would
   was measured wrong before it was written.**
2. **A scan yields exactly ONE image**, which becomes a 1-2 sentence vision caption. So the
   drawing is not invisible — it is *summarised*, which is worse, because a caption reads as
   knowledge. This is SEED-006's ~5% figure-survival meeting a document that is 100% figure.
3. ⚠ **pdfplumber reports a TABLE (1) in the drawing where camelot reports none.** Ruled
   lines in geometry are indistinguishable from a ruled table to a line-based detector, so a
   drawing can inject a fabricated table into the index. Not chased here; recorded because a
   BOQ built on a phantom table is exactly the failure this seed exists to prevent.
4. **The legacy fallback and the real path disagree on a scan (0 vs 1 image)** — ⚠ **and
   this is LATENT, NOT LIVE, which was checked rather than assumed.** `extract_composable`
   failing or timing out marks the document `failed` and returns (`documents.py:309-320`); it
   does not fall through with `extracted_doc=None`. Every current caller threads the composed
   document. **The trap is that `extract_and_store_images`' fallback branch would silently
   see zero images if a future caller ever omits it.**

⚠ **The stand-ins are NOT representative on one axis and it matters:** the vector fixture
measures **10** drawing ops where a real AutoCAD plot has thousands. The probe's
`vector_drawings > 0` heuristic is therefore tuned on a weak sample — **re-check the verdict
logic against the operator's real file before trusting the classification on anything else.**

## ⚠⚠ MEASURED ON A REAL DRAWING 2026-08-28 — AND IT IS WORSE THAN THE FIXTURE PREDICTED

The operator supplied a real residential floor plan (`screenshots/5c8c98858152b.pdf`, 99 KB,
1 page, A5 landscape). **This supersedes the synthetic numbers above, which are kept only to
show what the stand-in failed to capture.**

| | synthetic fixture | **REAL drawing** |
|---|---|---|
| vector drawing ops | 10 | **2,799** |
| line segments | — | **2,822** |
| text, `legacy` engine | 229 chars | **237 chars** |
| text, `pymupdf` engine | 229 — identical | **252 — NOT identical** |
| images | 0 | **0** |
| tables | camelot 0 · pdfplumber 1 | **camelot 1 · pdfplumber 4** |
| **numeric tokens in the whole text layer** | 8 dimensions | **EXACTLY ONE: `6`** |

**The entire text layer of the drawing, verbatim (252 chars, 33 spans, one font):**

> `BED ROOM KITCHEN BED ROOM KITCHEN BED ROOM KITCHEN BED ROOM KITCHEN HALL HALLHALL
> HALLBATHBATH BATHBATHVERANDA FIRST FLOORGROUND FLOOR KITCHENKITCHEN HALLHALL
> VERANDAVERANDA BED ROOMBED ROOMBATHBATHWASHWASH PASSAGE 6FEET WIDE CAR PARKING`

**⚠ THE PREDICTION IN THIS SEED WAS TOO OPTIMISTIC.** It said dimensions would arrive
*unanchored*. On this real drawing **they do not arrive at all** — the only number anywhere in
the text layer is the `6` in *"PASSAGE 6FEET WIDE"*. Room names arrive mashed together
(`HALLHALL`, `BATHBATH`) because adjacent text runs concatenate with no separator. **And there
are no images either**, so the vision-caption path — the one consolation for a scan — yields
nothing on a vector plot.

**So the app ingests this drawing as ~252 characters of run-together room names, reports
`completed`, and discards 2,822 line segments.** No error, no `needs OCR` sentence, nothing
red. A BOQ question against this document today is answered from room names alone.

**⚠ THE FINDING THAT CHANGES THE PLAN: the geometry is fully present and measurable.**

    line segments      : 2822
    total length (pt)  : 16342.0
    longest segment    : 254.3
    horizontal/vertical: 1399 / 1445   (overwhelmingly orthogonal — walls)
    geometry bbox (pt) : 89.0 17.8 → 329.6 580.5

Every wall is a `LINE` primitive with real coordinates, reachable in three lines of PyMuPDF
(`page.get_drawings()`). **This seed's L3 assumed DXF was the only route to real measurement.
That is now measured false for VECTOR PDFs** — the takeoff geometry is already in the PDF, and
what is missing is only **scale** (derivable from one known dimension, a title-block scale note,
or an operator-supplied reference). ⚠ **DXF remains strictly better** — it carries layers, block
names and entity types, so `INSERT` counting per block gives door/fixture COUNTS that bare
coordinates cannot. But an **L2.5 — vector-geometry takeoff straight from the PDF** — now exists
between L2 and L3, and it is cheaper than both.

**Two more measured notes:**

1. **The two text engines DISAGREE on a real file (237 vs 252)** — the fixture said identical.
   Neither is usable for takeoff, so this does not revive the engine-switch idea; it is recorded
   because *"the engines are equivalent"* is now known to be a fixture artefact.
2. ⚠ **pdfplumber reports FOUR phantom tables in the drawing geometry (camelot: 1).** At fixture
   scale this was 1 vs 0. **Four fabricated tables from one small floor plan** is the clearest
   evidence yet that drawing geometry is actively polluting the index, not merely absent from it.

**The pricing half is now VERIFIED rather than assumed.** A reference rate sheet
(`screenshots/BOQ-reference-rates.xlsx`, 24 priceable items across 8 categories, plus a
Preambles sheet of narrative rules that must NOT be priced) round-trips through the shipped
`extract_excel_tables` with headers and all 24 rows intact. ⚠ Both sheets report
`table_index: 0`, which was checked and is **NOT** a collision — `page` carries the 1-based
sheet number, so the pair stays unique.

**The DWG the operator supplied** (`architectural_-_annotation_scaling_and_multileaders.dwg`,
189 KB) has magic `AC1021` = **AutoCAD 2007 format**. `ezdxf` reads DXF, not DWG, so this file
needs a conversion step (ODA File Converter, free; or the CAD tool's own DXF export) before any
of L3 applies. Nothing in this repo can open it today.

## ⚠⚠⚠ THE DXF MEASURED 2026-08-28 — THIS SETTLES THE BUSINESS CASE

The operator converted the supplied DWG to DXF (`AC1018` / R2004, 1.0 MB, via cloudconvert)
and it was read with `ezdxf 1.4.4`. **This is the comparison the whole seed was waiting for.**

⚠ **NOT LIKE-FOR-LIKE, AND THAT IS STATED FIRST SO NOBODY QUOTES IT AS IF IT WERE.** The DXF is
a *different drawing* from the PDF — a structural/architectural SECTION detail, not the
residential floor plan. It therefore cannot show how much better DXF is *for that PDF*. What it
does show is what a DXF **carries as a format**, and that is the question that decides the
architecture.

| | the PDF (floor plan) | **the DXF (section detail)** |
|---|---|---|
| geometry | 2,822 anonymous lines | 1,178 LINE + 56 ARC + 32 LWPOLYLINE + 14 HATCH |
| **numbers available** | **ONE** (`6`) | **28 DIMENSION entities with computed values** |
| classification | none | **32 NAMED LAYERS** |
| countable items | none | **16 INSERT block references** |
| specification text | none | **36 MULTILEADER + 5 MTEXT** |

**1. Real measurements, not glyphs.** The 28 `DIMENSION` entities return values through
`get_measurement()`: `108.0, 104.0, 4.0, 12.0, 56.0, 70.5, 272.0, 390.0, 141.0, 249.0, 42.0 …`
⚠ **Note `text='<>'` on almost all of them** — `<>` is AutoCAD's placeholder meaning *"display
the measured value"*. **The number is not stored as text at all; it is COMPUTED from the
geometry.** That is precisely why the PDF has none: plotting resolves `<>` into line-art glyphs
that `page.get_text()` cannot see as numbers.

**2. Layers classify the geometry — the thing a PDF cannot do.** Wall length is separable from
handrail, ceiling, door and stair length *by name*:

    Arch_Section_Wall       50 lines    4,678.8 units
    Arch_Detail_Door        55 lines    2,250.0 units
    Arch_Section_Ceiling    17 lines    2,449.7 units
    Struc_Section_Conc     169 lines    3,859.3 units
    Struc_Section_Steel    133 lines    4,774.2 units

**3. Blocks give COUNTS for free** — `C250x23` ×8, `W250x33` ×2, `STAIR` ×2,
`outstandingconn1` ×4. Those are **standard steel section designations** (a 250mm channel and a
250mm wide-flange beam), so this is a steel schedule readable by counting, with no inference.

**4. ⚠ THE SPECIFICATIONS ARE IN THE FILE, AND THIS WAS NOT ANTICIPATED ANYWHERE IN THIS SEED.**
The multileaders carry what are effectively BOQ line-item descriptions already written by the
engineer:

> `2"x6" [38x140] WALL FRAMING` · `3/4"[30] O.S.B SHEATHING` · `1/2"[12.5] GYPSUM BOARD` ·
> `EPDM ROOFING MEMBRANE` · `HSS 1-1/2"x1-1/2" [38x38] RAILING (TYP.)` · `9.5%%C CABLES (TYP.)`

**Material, size and dual imperial/metric units, per element.** The seed assumed wall TYPE would
have to be inferred from line thickness; on this evidence it is often simply *written down*.

**Two practical notes for whoever implements it:** `d.units == 1` (**inches**) — unit resolution
is per-file and must never be assumed; and multileader text carries CAD formatting codes
(`\A1;`, `\W1.15;`, `\P`, `%%C`) that need stripping before use. Both are small, known problems.

### Verdict this produces

**L3 (DXF) is not merely "better" — it is a different class of answer.** The PDF path infers;
the DXF path reads. Everything the business case needs — measured dimensions, classified
quantities, item counts, material specs — is present as data.

**Recommended sequencing change:** this seed listed DXF as L3, *after* OCR and full-page vision.
**It should be FIRST.** It is the cheapest of the three (one MIT library, no per-page cost, no
model calls, no new infrastructure), the only one that yields *reliable* rather than *advisory*
output, and it is the one that makes the product promise defensible. OCR (L1) remains needed for
scans, and full-page vision (L2) for PDF-only clients — but neither should block L3.

⚠ **`ezdxf 1.4.4` was pip-installed into `backend/venv` for THIS EVALUATION ONLY.** It is not in
`requirements.txt` and is not a committed dependency; adding it is a phase decision, not a
side effect of a probe.

## Open questions for whoever picks this up

- Which OCR engine, decided on **real customer drawings**, not on a benchmark corpus.
- Does a `.dxf` upload become a first-class document type, or a sandbox-side tool the agent
  calls? (`ezdxf` in `Dockerfile.sandbox` is the cheap probe — one tag bump, `docs/SANDBOX-PACKAGES.md`
  updated in the same commit per the standing rule.)
- Where does per-page cost surface? OCR and full-page vision are **per page**, and a drawing set
  is many pages. The cap in SEED-227 is the control; the *estimate* is a separate UX question.
- How does a BOQ derived from L2 render its uncertainty, so no one prices a project off a guess?
