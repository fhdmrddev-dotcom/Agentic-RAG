"""Phase 071.1 — Diagnostic CLI: measure Docling stall duration end-to-end.

Loads a PDF (from Supabase by document_id, or from local file path), invokes the
project's DoclingExtractor (so env knobs and singleton apply identically to
/reextract), times the call, and prints the result. Useful for reproducing
timeouts against a known problem PDF without spinning up the full FastAPI stack.

Usage:
    cd backend
    venv/Scripts/python.exe scripts/probe_docling_timeout.py <document_id>
    venv/Scripts/python.exe scripts/probe_docling_timeout.py --file path/to/big.pdf

    # Tighter timeout for faster failure:
    EXTRACTOR_DOCLING_TIMEOUT_S=30 venv/Scripts/python.exe scripts/probe_docling_timeout.py --file big.pdf
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path


def load_from_file(path: str) -> tuple[bytes, str, str]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(path)
    raw = p.read_bytes()
    mime = "application/pdf" if p.suffix.lower() == ".pdf" else "application/octet-stream"
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
