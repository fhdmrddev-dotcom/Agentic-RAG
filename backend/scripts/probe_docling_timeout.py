"""Phase 071.2 Plan 03 — Detection-ceiling + markdown-sanity probe.

Originally Phase 071.1 — diagnostic CLI to measure Docling stall duration
end-to-end. Phase 071.2 extends the script with the markdown-vs-text chunker
differential (D-071.2-07 / D-071.2-13) plus per-tool PDF + DOCX detection-
ceiling counters (Plan 05 inputs):

    PDF:  pdfplumber.images vs fitz.get_images(full=True)
          pdfplumber.tables vs docling.tables
    DOCX: python-docx.inline_shapes vs ZIP a:blip count
          python-docx.tables       vs docling.tables

Loads a PDF or DOCX (from Supabase by document_id, or from local file path),
invokes the project's DoclingExtractor (so env knobs and singleton apply
identically to /reextract), times the call, and prints the full diagnostic
block.

Run against the thesis pair to confirm D-071.2-13 BEFORE Plan 05 commits:
    cd backend
    venv/Scripts/python.exe scripts/probe_docling_timeout.py 23cc112a-92c2-440f-83c9-13aa8bf3d53d
Required gate: chunks(full_markdown) >= 3 x chunks(text) AND len(full_markdown) >= len(text).

AGPL FENCE: this script MUST NOT `import fitz` at module top. PyMuPDF access
goes through `_run_pymupdf_subprocess` (Phase 071 Plan 03 fence preserved).

Usage:
    cd backend
    venv/Scripts/python.exe scripts/probe_docling_timeout.py <document_id>
    venv/Scripts/python.exe scripts/probe_docling_timeout.py --file path/to/big.pdf

    # Tighter timeout for faster failure:
    EXTRACTOR_DOCLING_TIMEOUT_S=30 venv/Scripts/python.exe scripts/probe_docling_timeout.py --file big.pdf
"""
from __future__ import annotations

import argparse
import io
import os
import time
from pathlib import Path

from app.services.extraction_service import DOCX_MIME


def load_from_file(path: str) -> tuple[bytes, str, str]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    raw = p.read_bytes()
    suffix = p.suffix.lower()
    if suffix == ".pdf":
        mime = "application/pdf"
    elif suffix == ".docx":
        mime = DOCX_MIME
    else:
        mime = "application/octet-stream"
    return raw, p.name, mime


def load_from_supabase(document_id: str) -> tuple[bytes, str, str]:
    from app.dependencies import get_supabase
    sb = get_supabase()
    doc_row = (
        sb.table("documents")
        .select("id, filename, mime_type, file_path")
        .eq("id", document_id)
        .single()
        .execute()
    )
    data = doc_row.data
    if not data:
        raise SystemExit(f"document_id {document_id} not found")
    raw = sb.storage.from_("documents").download(data["file_path"])
    return raw, data["filename"], data["mime_type"]


def probe(raw: bytes, mime: str, filename: str) -> None:
    from app.services.extractors.docling import DoclingExtractor

    timeout_env = os.getenv("EXTRACTOR_DOCLING_TIMEOUT_S", "120")
    print(f"[probe_docling_timeout] file={filename!r} mime={mime} size={len(raw):,} bytes")
    print(f"[probe_docling_timeout] EXTRACTOR_DOCLING_TIMEOUT_S={timeout_env}")

    extractor = DoclingExtractor()
    start = time.perf_counter()
    status = "success"
    error_msg: str | None = None
    result = None
    table_count = image_count = 0
    text_chars = 0
    try:
        result = extractor.extract(raw, mime)
        table_count = len(getattr(result, "tables", []) or [])
        image_count = len(getattr(result, "images", []) or [])
        text_chars = len(getattr(result, "text", "") or "")
    except Exception as exc:
        status = type(exc).__name__
        error_msg = str(exc)
    duration = time.perf_counter() - start

    print(f"[probe_docling_timeout] duration={duration:.2f}s status={status}")
    if error_msg:
        print(f"[probe_docling_timeout] error={error_msg!r}")
    print(
        f"[probe_docling_timeout] tables={table_count} images={image_count} "
        f"text_chars={text_chars}"
    )

    # If Docling failed, downstream diagnostics can't run — bail cleanly.
    if result is None:
        print("[probe] Docling extract failed; skipping markdown + ceiling diagnostics.")
        return

    # ------------------------------------------------------------------
    # Section A — Markdown sanity (always runs)
    # Phase 071.2 D-071.2-07 / D-071.2-13 — the chunk-count differential
    # is the binding gate for Plan 05.
    # ------------------------------------------------------------------
    text_chars = len(result.text or "")
    md_chars = len(result.full_markdown or "")
    from app.services.embedding_service import chunk_text
    chunks_from_text = len(chunk_text(result.text or ""))
    chunks_from_md = (
        len(chunk_text(result.full_markdown))
        if result.full_markdown else 0
    )
    print(f"[probe] len(text)={text_chars:,}  len(full_markdown)={md_chars:,}")
    print(f"[probe] chunks(text)={chunks_from_text}  chunks(full_markdown)={chunks_from_md}")

    # ------------------------------------------------------------------
    # Section B — PDF detection ceiling (only when mime == application/pdf)
    # ------------------------------------------------------------------
    pp_images = pp_tables = 0
    fitz_images = -1
    if mime == "application/pdf":
        import pdfplumber  # noqa: PLC0415
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            pp_images = sum(len(p.images) for p in pdf.pages)
            pp_tables = sum(len(p.extract_tables() or []) for p in pdf.pages)
        try:
            # AGPL fence: route PyMuPDF through the subprocess wrapper, never
            # `import fitz` here. RESEARCH-COMPLETENESS Part E + Phase 071 Plan 03.
            from app.services.extractors.pymupdf import _run_pymupdf_subprocess  # noqa: PLC0415
            ed_pymupdf = _run_pymupdf_subprocess(raw, mime)
            fitz_images = len(ed_pymupdf.images or [])
        except Exception as e:
            print(f"[probe] pymupdf subprocess error: {e}")
        print(f"[probe] PDF: pdfplumber.images={pp_images}  fitz.get_images(full=True)={fitz_images}")
        print(f"[probe] PDF: pdfplumber.tables={pp_tables}  docling.tables={len(result.tables)}")

    # ------------------------------------------------------------------
    # Section C — DOCX detection ceiling (only when mime == DOCX_MIME)
    # ------------------------------------------------------------------
    inline = 0
    blip_count = vml_count = media_count = 0
    if mime == DOCX_MIME:
        from docx import Document as DocxDocument  # noqa: PLC0415
        d = DocxDocument(io.BytesIO(raw))
        inline = len(d.inline_shapes)
        import zipfile  # noqa: PLC0415
        from lxml import etree  # noqa: PLC0415
        NS = {
            "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
            "v": "urn:schemas-microsoft-com:vml",
        }
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for n in zf.namelist():
                if n.endswith(".xml") and (
                    n.startswith("word/document")
                    or n.startswith("word/header")
                    or n.startswith("word/footer")
                ):
                    try:
                        tree = etree.fromstring(zf.read(n))
                    except etree.XMLSyntaxError:
                        continue
                    blip_count += len(tree.findall(".//a:blip", NS))
                    vml_count += len(tree.findall(".//v:imagedata", NS))
            media_count = sum(1 for n in zf.namelist() if n.startswith("word/media/"))
        print(
            f"[probe] DOCX: inline_shapes={inline}  zip a:blip={blip_count}  "
            f"v:imagedata={vml_count}  word/media/={media_count}"
        )
        print(
            f"[probe] DOCX: python-docx.tables={len(d.tables)}  "
            f"docling.tables={len(result.tables)}"
        )

    # ------------------------------------------------------------------
    # Section D — Verdict block (RESEARCH-COMPLETENESS Part E expected-output style)
    # ------------------------------------------------------------------
    if mime == DOCX_MIME and inline == 0 and blip_count > 0:
        print(
            f"[VERDICT] DETECTION CEILING HIT: inline_shapes=0 but ZIP "
            f"a:blip={blip_count}. Plan 05 zip_xpath_docx required."
        )
    if mime == "application/pdf" and pp_images < (fitz_images or 0) // 5:
        print(
            f"[VERDICT] DETECTION CEILING HIT: pdfplumber.images={pp_images} "
            f"<< fitz.get_images(full=True)={fitz_images}. Plan 05 pymupdf_full required."
        )
    if chunks_from_md >= 3 * chunks_from_text:
        print(
            f"[VERDICT] D-071.2-13 GATE GREEN: "
            f"chunks(full_markdown)={chunks_from_md} >= 3x chunks(text)={chunks_from_text}."
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="Probe Docling stall duration on a single PDF.")
    ap.add_argument("document_id", nargs="?", help="Supabase documents.id to load")
    ap.add_argument("--file", help="Local file path (alternative to document_id)")
    args = ap.parse_args()

    if args.file:
        raw, filename, mime = load_from_file(args.file)
    elif args.document_id:
        raw, filename, mime = load_from_supabase(args.document_id)
    else:
        ap.error("Provide either a document_id positional or --file")

    probe(raw, mime, filename)


if __name__ == "__main__":
    main()
