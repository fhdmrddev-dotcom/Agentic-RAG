"""Table-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Each function takes (raw_bytes, mime) and returns list[TableData].
Lazy imports keep heavy table engines out of FastAPI startup (Pattern SP-4).
"""
from __future__ import annotations

import logging

from app.services.extraction_service import PDF_MIME, DOCX_MIME, TableData

log = logging.getLogger(__name__)


def pdfplumber_tables(raw: bytes, mime: str) -> list[TableData]:
    """Legacy pdfplumber/python-docx table extraction — wraps
    multimodal_service.extract_pdf_tables / extract_docx_tables.

    Returns list[TableData] with bbox=None (pdfplumber doesn't expose
    layout coordinates in the dicts it returns).
    """
    from app.services.multimodal_service import (  # noqa: PLC0415
        extract_pdf_tables,
        extract_docx_tables,
    )
    if mime == PDF_MIME:
        dicts = extract_pdf_tables(raw)
    elif mime == DOCX_MIME:
        dicts = extract_docx_tables(raw)
    else:
        return []
    return [TableData(**d) for d in dicts]


def camelot_tables(raw: bytes, mime: str) -> list[TableData]:
    """Camelot 1.0 Stream-mode (pdfium-backed) table extraction. PDF-only.

    Phase 071.3 Plan 02 D-071.3-05 — winner of the Plan 01 bench
    (camelot found 214 raw tables on the user's thesis vs pymupdf's 188;
    gmft excluded due to transformers/huggingface_hub strict-dataclass
    incompatibility with the published TATR config — see WINNER.md).

    Flavor=stream uses PDFMiner whitespace clustering — best for borderless
    academic tables per arXiv 2410.09871 Section 2.3. ~80 MB install
    (opencv-headless + pdfminer.six + pdfium). Returns list[TableData]
    with bbox populated from camelot Table._bbox (page coordinates).

    Failure policy (D-071.3-06): no internal try/except around camelot
    calls. Camelot exceptions (parse errors, malformed PDFs, OOM) bubble
    to `extract_composable`, which catches and stores in
    `table_extraction_error`. No silent fallback — user recovers via
    /reextract?engines=tables:pdfplumber.

    Threading (D-v2.5-01/02): single uvicorn worker + route-level
    `run_in_threadpool` wrap in documents.py already covers off-loop
    execution; no second wrap inside this adapter.
    """
    if mime != PDF_MIME:
        return []
    import os  # noqa: PLC0415
    import tempfile  # noqa: PLC0415
    import camelot  # noqa: PLC0415

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(raw)
        tmp_path = tf.name
    try:
        tables = camelot.read_pdf(tmp_path, flavor="stream", pages="all")
        out: list[TableData] = []
        rejected = 0
        for ti, t in enumerate(tables):
            df = t.df
            # Precision floor (SEED-022): camelot flavor=stream over-detects
            # single-row formula blocks and single-col reference lists as
            # tables. Require >=2 rows AND >=2 cols. Damage control before
            # the full precision audit Phase 076 prereq.
            if len(df) < 2 or len(df.columns) < 2:
                rejected += 1
                continue
            # Stream-mode treats the first detected row as the header band.
            if len(df) > 0:
                headers = [str(c) for c in df.iloc[0].tolist()]
                rows = [
                    [str(c) for c in row]
                    for row in df.iloc[1:].values.tolist()
                ]
            else:
                headers = []
                rows = []
            bbox: dict | None = None
            raw_bbox = getattr(t, "_bbox", None)
            if raw_bbox is not None:
                try:
                    l_, t_top, r_, b_ = raw_bbox
                    page_no = (
                        int(t.page) if getattr(t, "page", None) is not None else None
                    )
                    bbox = {
                        "l": float(l_),
                        "t": float(t_top),
                        "r": float(r_),
                        "b": float(b_),
                        "page": page_no,
                    }
                except (TypeError, ValueError) as exc:
                    log.warning(
                        "camelot_tables: failed to parse bbox on table %d: %s",
                        ti,
                        exc,
                    )
            out.append(
                TableData(
                    page=int(t.page) if getattr(t, "page", None) is not None else None,
                    table_index=ti,
                    headers=headers,
                    rows=rows,
                    bbox=bbox,
                )
            )
        if rejected:
            log.info(
                "camelot_tables: precision floor rejected %d of %d candidate regions (<2 rows or <2 cols)",
                rejected,
                len(tables),
            )
        return out
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
